import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import { getTabId } from 'Modules/@apostrophecms/ui/utils';
import { useScreen, isWindow } from 'Modules/@apostrophecms/ui/composables/useScreen.js';
import { useModalStore } from 'Modules/@apostrophecms/ui/stores/modal';
import { browserTools } from '../lib/browser-tools.js';

/**
 * The assistant's chats as this browser tab sees them. The records on the
 * server are the truth: everything here is read from the routes, and the
 * `assistant-chat` bus event only says what to read again. A missed event
 * costs speed, never truth: coming back to the browser tab reads it all.
 *
 * The chat tabs are this browser tab's own, kept in session storage. A new
 * chat is created on the server by its first send, so `NEW_CHAT` stands for
 * the chat tab of a chat that has no record yet.
 *
 * A request this browser tab owns may wait on a browser ask: the store runs
 * the browser tool's executor (lib/browser-tools.js) and answers with the
 * screen after it, whether the panel is open or not. A hidden browser tab
 * runs nothing: it answers what the server would. Executors act one at a
 * time. A tool that changes the screen also waits for its chat tab to be the
 * active one, for as long as it takes, and for every screen hold to clear,
 * for `screenWait` at most, then it is refused naming the holder. Screen
 * holds: another request while one of its executors runs or an editor it
 * opened is open; the editor with a modal open or unsaved changes on the
 * page. An `editMode` ask is such a step too, before a write to the page:
 * the page enters edit mode.
 *
 * Revert takes back a request and every later one. A dry run decides: a
 * clean revert runs at once, any other waits on the editor's confirmation,
 * which is this page's alone and never stored. Once a revert this page
 * started is done, the reverted message returns to the composer.
 */

export const NEW_CHAT = 'new';

const STORAGE_KEY = 'aposAssistantTabs';
// The asks this browser tab answers on its own
const SERVED_KINDS = [ 'browser', 'editMode' ];
// Events arrive in bursts: one read per chat for each burst
const LOAD_DELAY = 50;

export const useAssistantStore = defineStore('assistant', () => {
  const { getScreen } = useScreen();
  // The editor's chats, newest first
  const chats = ref([]);
  const loaded = ref(false);
  // Each loaded chat's requests in the order they were sent, by chat id
  const requests = ref({});
  // The chat tabs open in this browser tab, and the active one
  const tabs = ref([ NEW_CHAT ]);
  const activeId = ref(NEW_CHAT);
  // What the composer holds, by chat tab
  const drafts = ref({});
  // Why the last send of a chat tab was refused: `{ title, text }`
  const refusals = ref({});
  // What a running request is doing now, by request id: `{ label }`, or
  // `{ retrying: true }` while the provider call is retried. Progress is
  // never stored, so a reload starts without it
  const progress = ref({});
  // Each loaded chat's reverts in the order they were made, by chat id
  const reverts = ref({});
  // How far a running revert got, by revert id: `{ done, total }`, newer
  // than its record's `progress`
  const revertProgress = ref({});
  // The revert waiting on the editor's confirmation, by chat id:
  // `{ requestId, requestIds, documents, cause }`
  const confirmations = ref({});
  // The request whose revert's dry run is under way, by chat id
  const checking = ref({});

  // Whether this browser tab is visible, as the page last reported it
  const visible = ref(document.visibilityState !== 'hidden');
  // The browser step each open request of this browser tab is on, by
  // request id: `{ callId, label, state, holder, status }`, `state` one of
  // `attention` (its chat tab is not the active one), `hold` (`holder`
  // holds the screen), `queued` (another executor acts), `acting`, or
  // `released` (the executor waits on the editor, `status` saying for what)
  const browserSteps = ref({});
  // The executor acting now: `{ callId, requestId }`
  const acting = ref(null);
  // Asks run but not answered yet, released executors included: request
  // id by call id
  const executors = ref(new Map());
  // The modals an executor opened: request id by modal id
  const modalOwners = ref(new Map());

  let started = false;
  let chatsSequence = 0;
  const chatSequences = new Map();
  const pending = new Set();
  let timer = null;
  // The browser asks taken on this page, by call id: each runs once
  const served = new Set();
  // The reverts this page started, whose message returns once done
  const returning = new Set();

  function getAction() {
    return apos.modules['@apostrophecms/assistant'].action;
  }

  function getChat(id) {
    return chats.value.find(chat => chat._id === id) || null;
  }

  /**
   * The browser step the chat's open request is on in this browser tab, or
   * `null` (see `browserSteps`).
   *
   * @param {object|null} chat
   * @returns {object|null}
   */
  function getBrowserStep(chat) {
    const open = chat?.openRequest;
    if ((getOwner(chat) !== 'here') || (open.status !== 'waiting')) {
      return null;
    }
    return browserSteps.value[open._id] || null;
  }

  /**
   * Who owns the chat's open request: `'none'` when the chat is idle,
   * `'here'` for this browser tab, `'elsewhere'` for another one.
   *
   * @param {object|null} chat
   * @returns {'none'|'here'|'elsewhere'}
   */
  function getOwner(chat) {
    const open = chat?.openRequest;
    if (!open) {
      return 'none';
    }
    return (open.tabId === getTabId()) ? 'here' : 'elsewhere';
  }

  // Starts following the records, once per page: the panel may close and
  // open again, and a request this page sent keeps running meanwhile
  async function start() {
    if (!started) {
      started = true;
      restoreTabs();
      apos.bus.$on('assistant-chat', onEvent);
      document.addEventListener('visibilitychange', onVisibilityChange);
      // Back from another window (a terminal, say) is a focus with no
      // change of visibility
      window.addEventListener('focus', catchUp);
      // A modal opened while an executor acts is its request's
      apos.bus.$on('modal-launched', (item) => {
        if (acting.value) {
          modalOwners.value.set(item.id, acting.value.requestId);
        }
      });
      apos.bus.$on('modal-resolved', (item) => {
        modalOwners.value.delete(item.id);
      });
    }
    await catchUp();
  }

  // At page load: a browser tab with chat tabs from an earlier page follows
  // its chats again
  function resume() {
    let stored = null;
    try {
      stored = window.sessionStorage.getItem(STORAGE_KEY);
    } catch (e) {
      // A browser tab without storage starts with the panel
    }
    if (stored) {
      start();
    }
  }

  // Everything that may have changed while nobody was looking
  async function catchUp() {
    if (document.visibilityState === 'hidden') {
      return;
    }
    await loadChats();
    if (activeId.value !== NEW_CHAT) {
      await loadChat(activeId.value);
    }
  }

  async function onVisibilityChange() {
    visible.value = document.visibilityState !== 'hidden';
    if (chats.value.some(chat => getOwner(chat) === 'here')) {
      try {
        await apos.http.post(`${getAction()}/visibility`, {
          body: {
            tabId: getTabId(),
            visible: visible.value
          }
        });
      } catch (e) {
        // The next message reports the screen again
      }
    }
    if (visible.value) {
      await catchUp();
    }
  }

  function onEvent(event) {
    const {
      chatId, stage, requestId
    } = event || {};
    if (!chatId) {
      return;
    }
    if ((stage === 'chat') && event.deleted) {
      forget(chatId);
      return;
    }
    if ([ 'chat', 'request', 'revert' ].includes(stage)) {
      if (stage === 'request') {
        delete progress.value[requestId];
      }
      if (stage === 'revert') {
        delete revertProgress.value[event.revertId];
      }
      schedule('chats');
      if (requests.value[chatId] || tabs.value.includes(chatId)) {
        schedule(chatId);
      }
      return;
    }
    if (stage === 'revertProgress') {
      revertProgress.value[event.revertId] = {
        done: event.done,
        total: event.total
      };
      return;
    }
    if ((stage === 'tool') && (event.phase === 'start')) {
      progress.value[requestId] = { label: event.label || null };
    } else if (stage === 'message') {
      progress.value[requestId] = { label: null };
    } else if (stage === 'retry') {
      progress.value[requestId] = { retrying: true };
    }
  }

  function schedule(target) {
    pending.add(target);
    if (timer) {
      return;
    }
    timer = setTimeout(() => {
      timer = null;
      const targets = [ ...pending ];
      pending.clear();
      for (const target of targets) {
        if (target === 'chats') {
          loadChats();
        } else {
          loadChat(target);
        }
      }
    }, LOAD_DELAY);
  }

  async function loadChats() {
    const sequence = ++chatsSequence;
    let result;
    try {
      result = await apos.http.get(`${getAction()}/chat`, {});
    } catch (e) {
      report(e);
      return;
    }
    if (sequence !== chatsSequence) {
      return;
    }
    chats.value = result.chats;
    loaded.value = true;
    for (const id of tabs.value) {
      if ((id !== NEW_CHAT) && !getChat(id)) {
        forget(id);
      }
    }
    // A request here waiting on an ask, in a chat tab open or not
    for (const chat of chats.value) {
      if ((getOwner(chat) === 'here') && (chat.openRequest.status === 'waiting')) {
        schedule(chat._id);
      }
    }
  }

  async function loadChat(id) {
    const sequence = (chatSequences.get(id) || 0) + 1;
    chatSequences.set(id, sequence);
    let result;
    try {
      result = await apos.http.get(`${getAction()}/chat/${id}`, {});
    } catch (e) {
      if (e.status === 404) {
        forget(id);
      } else {
        report(e);
      }
      return;
    }
    if (chatSequences.get(id) !== sequence) {
      return;
    }
    setChat(result.chat);
    requests.value[id] = result.requests;
    reverts.value[id] = result.reverts;
    returnMessages(id);
    serveAsks(id);
  }

  // The message of each revert this page started returns to the composer
  // once the revert is done, in front of any draft
  function returnMessages(id) {
    for (const revert of reverts.value[id] || []) {
      if (!returning.has(revert._id) || (revert.status === 'running')) {
        continue;
      }
      returning.delete(revert._id);
      const [ first ] = revert.requestIds;
      const message = (revert.status === 'done') &&
        requests.value[id]?.find(request => request._id === first)?.message;
      if (message) {
        const draft = drafts.value[id] || '';
        setDraft(id, draft.trim() ? `${message}\n\n${draft}` : message);
      }
    }
  }

  // The browser asks of the chat's request, when this browser tab owns it
  function serveAsks(id) {
    const chat = getChat(id);
    if ((getOwner(chat) !== 'here') || (chat.openRequest.status !== 'waiting')) {
      return;
    }
    const request = requests.value[id]?.find(each => each._id === chat.openRequest._id);
    for (const ask of request?.asks || []) {
      if (!SERVED_KINDS.includes(ask.kind) || served.has(ask.callId)) {
        continue;
      }
      served.add(ask.callId);
      serveAsk(id, request, ask);
    }
  }

  // Waits for the ask's turn, runs the executor and answers. An ask that
  // is no longer this browser tab's is left; an answer the server didn't
  // take is given up, the reason in the console: the editor can still stop
  // the request. One that never arrived, or arrived after the request moved
  // to another browser tab, is served again if the records show it here
  async function serveAsk(id, request, ask) {
    const turn = await waitForTurn(id, request, ask);
    if (turn.state === 'gone') {
      served.delete(ask.callId);
      clearBrowserStep(request._id, ask.callId);
      return;
    }
    let answer;
    if (turn.state === 'hidden') {
      answer = ask.payload.whenHidden;
    } else if (turn.state === 'hold') {
      answer = {
        executed: false,
        reason: `the screen is held: ${describeHolder(turn.holder)}`
      };
    } else {
      answer = await execute(id, request, ask);
    }
    if (answer === null) {
      return;
    }
    // Until the answer is in, the request's next ask waits: the server
    // goes on from one answer at a time
    executors.value.set(ask.callId, request._id);
    try {
      await apos.http.post(`${getAction()}/chat/${id}/answer`, {
        body: {
          tabId: getTabId(),
          callId: ask.callId,
          answer,
          screen: getScreen()
        }
      });
    } catch (e) {
      if (!e.status || (e.status === 409)) {
        served.delete(ask.callId);
      } else {
        report(e);
      }
    }
    try {
      await loadChats();
      await loadChat(id);
    } finally {
      executors.value.delete(ask.callId);
      clearBrowserStep(request._id, ask.callId);
    }
  }

  // Resolves with the ask's turn once it has one: `run` (the executor may
  // act, and does so now: it is marked acting at once), `hidden` (answer
  // as the server would), `gone` (no longer this browser tab's), or `hold`
  // after waiting `screenWait` on a screen hold, with its holder
  function waitForTurn(id, request, ask) {
    const changes = ask.payload.screenEffect === 'changes';
    const { screenWait } = apos.modules['@apostrophecms/assistant'];
    const label = request.steps?.find(step => step.id === ask.callId)?.label || null;
    return new Promise((resolve) => {
      let timer = null;
      let stop = null;
      if (settle(getTurn())) {
        return;
      }
      stop = watch(getTurn, settle);

      function getTurn() {
        if (!isServed(id, request._id, ask.callId)) {
          return { state: 'gone' };
        }
        if (!visible.value) {
          return { state: 'hidden' };
        }
        if (changes && (activeId.value !== id)) {
          return { state: 'attention' };
        }
        const holder = changes ? getHolder(request._id) : null;
        if (holder) {
          return {
            state: 'hold',
            holder
          };
        }
        const busy = acting.value ||
          [ ...executors.value.values() ].includes(request._id);
        return { state: busy ? 'queued' : 'run' };
      }

      // Waiting for a screen hold is bounded; any other wait is not
      function settle(turn) {
        if (turn.state === 'hold') {
          timer = timer || setTimeout(() => done(getTurn()), screenWait);
        } else if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        if ([ 'run', 'hidden', 'gone' ].includes(turn.state)) {
          return done(turn);
        }
        setBrowserStep(request._id, {
          callId: ask.callId,
          label,
          state: turn.state,
          holder: turn.holder || null
        });
        return false;
      }

      // The timer's last look may find the hold gone: then it is not
      // refused, and waits for its turn as before
      function done(turn) {
        if ((turn.state === 'queued') || (turn.state === 'attention')) {
          timer = null;
          return settle(turn);
        }
        if (turn.state === 'run') {
          acting.value = {
            callId: ask.callId,
            requestId: request._id
          };
          executors.value.set(ask.callId, request._id);
          setBrowserStep(request._id, {
            callId: ask.callId,
            label,
            state: 'acting'
          });
        }
        clearTimeout(timer);
        stop?.();
        resolve(turn);
        return true;
      }
    });
  }

  // Runs the executor marked acting. Once it calls `release`, it only
  // waits on the editor: the next executor may act, while its request
  // still holds the screen until its answer is in
  async function execute(id, request, ask) {
    const { callId } = ask;
    const free = () => {
      if (acting.value?.callId === callId) {
        acting.value = null;
      }
    };
    const release = (status = null) => {
      free();
      const step = browserSteps.value[request._id];
      if (step?.callId === callId) {
        setBrowserStep(request._id, {
          ...step,
          state: 'released',
          status
        });
      }
    };
    try {
      const executor = (ask.kind === 'editMode')
        ? enterEditMode
        : browserTools.get(ask.name);
      return executor
        ? await executor(ask.payload.args, {
          screen: getScreen(),
          request,
          ask,
          release
        })
        : {
          executed: false,
          reason: `this page has no "${ask.name}" browser tool`
        };
    } catch (e) {
      report(e);
      return {
        executed: false,
        reason: 'the action failed in the browser'
      };
    } finally {
      free();
    }
  }

  // The page in edit mode before the request writes it, so the write lands
  // in the page's undo history
  async function enterEditMode() {
    const editing = await window.apos.adminBar?.setEditMode?.(true);
    return editing
      ? { executed: true }
      : {
        executed: false,
        reason: 'the page could not enter edit mode'
      };
  }

  // Whether the ask is still one this browser tab serves: its request open
  // here, waiting, and the ask among its asks
  function isServed(id, requestId, callId) {
    const chat = getChat(id);
    const open = chat?.openRequest;
    if ((getOwner(chat) !== 'here') || (open._id !== requestId) ||
      (open.status !== 'waiting')) {
      return false;
    }
    const record = requests.value[id]?.find(each => each._id === requestId);
    return Boolean(record?.asks?.some(each => each.callId === callId));
  }

  /**
   * Who holds the screen against a screen-changing step of `requestId`:
   * another open request while one of its executors runs or a modal it
   * opened is open (`{ requestId, title }`), else the editor with a modal
   * open (`{ modal }`, its kind) or unsaved changes on the page
   * (`{ unsaved: true }`). `null` when nobody does.
   *
   * @param {string} requestId
   * @returns {object|null}
   */
  function getHolder(requestId) {
    const other = owner => (owner !== requestId) && getOpenChat(owner);
    for (const owner of executors.value.values()) {
      if (other(owner)) {
        return byRequest(owner);
      }
    }
    for (const entry of useModalStore().stack) {
      if (isWindow(entry)) {
        continue;
      }
      const owner = modalOwners.value.get(entry.id);
      if (owner && getOpenChat(owner)) {
        if (owner === requestId) {
          continue;
        }
        return byRequest(owner);
      }
      return { modal: entry.screen?.kind || 'other' };
    }
    if (window.apos.adminBar?.hasUnsavedChanges?.()) {
      return { unsaved: true };
    }
    return null;

    function byRequest(owner) {
      return {
        requestId: owner,
        title: getOpenChat(owner).title || null
      };
    }
  }

  // The chat whose open request is `requestId`
  function getOpenChat(requestId) {
    return chats.value.find(chat => chat.openRequest?._id === requestId) || null;
  }

  // The holder as the model reads it in a refusal
  function describeHolder(holder) {
    if (holder.requestId) {
      return `another chat${holder.title ? ` ("${holder.title}")` : ''} is changing it`;
    }
    if (holder.modal) {
      return `the user has a modal open over the page (${holder.modal})`;
    }
    return 'the user has unsaved changes on the page';
  }

  function setBrowserStep(requestId, step) {
    browserSteps.value = {
      ...browserSteps.value,
      [requestId]: step
    };
  }

  function clearBrowserStep(requestId, callId) {
    if (browserSteps.value[requestId]?.callId !== callId) {
      return;
    }
    const { [requestId]: ignored, ...rest } = browserSteps.value;
    browserSteps.value = rest;
  }

  function setChat(chat) {
    const index = chats.value.findIndex(each => each._id === chat._id);
    if (index === -1) {
      chats.value = [ chat, ...chats.value ];
    } else {
      chats.value.splice(index, 1, chat);
    }
  }

  // A chat that is gone: deleted here, in another browser tab, or not found
  function forget(id) {
    chats.value = chats.value.filter(chat => chat._id !== id);
    delete requests.value[id];
    delete reverts.value[id];
    delete confirmations.value[id];
    delete refusals.value[id];
    if (tabs.value.includes(id)) {
      closeTab(id);
    }
  }

  // An empty new chat in front gives way to the chat opened
  function openChat(id) {
    if (!tabs.value.includes(id)) {
      const blank = (activeId.value === NEW_CHAT) && !drafts.value[NEW_CHAT]?.trim();
      if (blank) {
        tabs.value.splice(tabs.value.indexOf(NEW_CHAT), 1, id);
        delete refusals.value[NEW_CHAT];
      } else {
        tabs.value.push(id);
      }
    }
    activate(id);
  }

  function newChat() {
    if (!tabs.value.includes(NEW_CHAT)) {
      tabs.value.push(NEW_CHAT);
    }
    activate(NEW_CHAT);
  }

  function activate(id) {
    activeId.value = id;
    rememberTabs();
    if (id !== NEW_CHAT) {
      loadChat(id);
    }
  }

  // The chat tab to the right of a closed active one takes its place, else
  // the one to its left, else a new chat
  function closeTab(id) {
    const index = tabs.value.indexOf(id);
    if (index === -1) {
      return;
    }
    tabs.value.splice(index, 1);
    if (id === NEW_CHAT) {
      delete drafts.value[NEW_CHAT];
      delete refusals.value[NEW_CHAT];
    }
    if (activeId.value === id) {
      const next = tabs.value[index] || tabs.value[index - 1];
      if (next) {
        activate(next);
      } else {
        newChat();
      }
      return;
    }
    rememberTabs();
  }

  async function rename(id, title) {
    const { chat } = await apos.http.patch(`${getAction()}/chat/${id}`, {
      body: { title }
    });
    setChat(chat);
  }

  /**
   * Deletes a chat. Refused while its request runs: resolves `false` and
   * reads the chats again, since the view was stale.
   *
   * @param {string} id
   * @returns {Promise<boolean>}
   */
  async function remove(id) {
    try {
      await apos.http.delete(`${getAction()}/chat/${id}`, {});
    } catch (e) {
      if (e.status === 404) {
        forget(id);
        return true;
      }
      await loadChats();
      if (e.status === 409) {
        return false;
      }
      throw e;
    }
    forget(id);
    return true;
  }

  /**
   * Sends the draft of a chat tab. A refused send keeps the draft and says
   * why on the chat tab, and the records are read again, so the panel
   * shows what is true now.
   *
   * @param {string} id A chat id, or `NEW_CHAT`.
   */
  async function send(id) {
    const message = (drafts.value[id] || '').trim();
    if (!message) {
      return;
    }
    delete refusals.value[id];
    let chatId = id;
    try {
      if (id === NEW_CHAT) {
        const { chat } = await apos.http.post(`${getAction()}/chat`, { body: {} });
        setChat(chat);
        chatId = chat._id;
        requests.value[chatId] = [];
        tabs.value.splice(tabs.value.indexOf(NEW_CHAT), 1, chatId);
        drafts.value[chatId] = drafts.value[NEW_CHAT];
        delete drafts.value[NEW_CHAT];
        if (activeId.value === NEW_CHAT) {
          activeId.value = chatId;
        }
        rememberTabs();
      }
      const { request } = await apos.http.post(`${getAction()}/chat/${chatId}/send`, {
        body: {
          message,
          screen: getScreen()
        }
      });
      if ((drafts.value[chatId] || '').trim() === message) {
        delete drafts.value[chatId];
      }
      requests.value[chatId] = [
        ...(requests.value[chatId] || []).filter(each => each._id !== request._id),
        request
      ];
    } catch (e) {
      refuse(chatId, e);
    }
    await loadChats();
    if (getChat(chatId)) {
      await loadChat(chatId);
    }
  }

  /**
   * Stops the chat's open request, running or waiting. Any browser tab may
   * stop it; a stop the server refuses means the view was stale, and
   * reading the records again shows what is true now.
   *
   * @param {string} id
   */
  async function stop(id) {
    try {
      await apos.http.post(`${getAction()}/chat/${id}/stop`, { body: {} });
    } catch (e) {
      // Not running any more, or deleted: the records say which
      if (![ 404, 409 ].includes(e.status)) {
        report(e);
      }
    }
    await loadChats();
    await loadChat(id);
  }

  /**
   * Makes this browser tab the owner of the chat's waiting request, with
   * its screen: from then on it answers the request's asks. A refusal
   * means the view was stale: the records are read again.
   *
   * @param {string} id
   */
  async function continueHere(id) {
    try {
      await apos.http.post(`${getAction()}/chat/${id}/continue-here`, {
        body: {
          tabId: getTabId(),
          screen: getScreen()
        }
      });
    } catch (e) {
      if (![ 404, 409 ].includes(e.status)) {
        report(e);
      }
    }
    await loadChats();
    await loadChat(id);
  }

  /**
   * Answers the editor's ask of the chat's waiting request from this
   * browser tab, with its screen as it is now. A refusal means the view was
   * stale: the records are read again.
   *
   * @param {string} id
   * @param {string} callId The tool call that asked.
   * @param {object} value What the ask's kind takes.
   * @returns {Promise<boolean>} Whether the server took it.
   */
  async function answer(id, callId, value) {
    let taken = true;
    try {
      await apos.http.post(`${getAction()}/chat/${id}/answer`, {
        body: {
          tabId: getTabId(),
          callId,
          answer: value,
          screen: getScreen()
        }
      });
    } catch (e) {
      taken = false;
      if (![ 404, 409 ].includes(e.status)) {
        report(e);
      }
    }
    await loadChats();
    await loadChat(id);
    return taken;
  }

  /**
   * Skips the questions of the chat's waiting request, which ends it. A
   * refusal means the view was stale: the records are read again.
   *
   * @param {string} id
   */
  async function skip(id) {
    try {
      await apos.http.post(`${getAction()}/chat/${id}/skip`, {
        body: { tabId: getTabId() }
      });
    } catch (e) {
      if (![ 404, 409 ].includes(e.status)) {
        report(e);
      }
    }
    await loadChats();
    await loadChat(id);
  }

  /**
   * Sends the chat's failed latest request again, as a new request. A
   * refusal says why on the chat tab, as a refused send does.
   *
   * @param {string} id
   * @param {string} requestId
   */
  async function retry(id, requestId) {
    delete refusals.value[id];
    try {
      await apos.http.post(`${getAction()}/chat/${id}/retry`, {
        body: {
          requestId,
          screen: getScreen()
        }
      });
    } catch (e) {
      refuse(id, e);
    }
    await loadChats();
    if (getChat(id)) {
      await loadChat(id);
    }
  }

  /**
   * Starts reverting a request and every later one: a dry run first, then
   * a clean revert runs at once and any other waits on the editor's
   * confirmation (`confirmations`). A refusal means the view was stale:
   * the records are read again.
   *
   * @param {string} id
   * @param {string} requestId The earliest request to revert.
   * @param {object} [options]
   * @param {string} [options.cause] `planCancel` when the editor cancelled
   *   the request's plan.
   */
  async function startRevert(id, requestId, { cause = null } = {}) {
    if (checking.value[id]) {
      return;
    }
    checking.value[id] = requestId;
    delete confirmations.value[id];
    try {
      const { requestIds, documents } = await apos.http.post(
        `${getAction()}/chat/${id}/revert-check`,
        {
          body: {
            requestId,
            tabId: getTabId()
          }
        }
      );
      const clean = documents.every(document => [ 'putBack', 'reverted' ].includes(document.outcome));
      if (clean) {
        await runRevert(id, requestId, cause);
      } else {
        confirmations.value[id] = {
          requestId,
          requestIds,
          documents,
          cause
        };
      }
    } catch (e) {
      if (![ 400, 404, 409 ].includes(e.status)) {
        report(e);
      }
    } finally {
      delete checking.value[id];
    }
    await loadChats();
    await loadChat(id);
  }

  // The revert the editor confirmed
  async function confirmRevert(id) {
    const confirmation = confirmations.value[id];
    if (!confirmation) {
      return;
    }
    delete confirmations.value[id];
    try {
      await runRevert(id, confirmation.requestId, confirmation.cause);
    } catch (e) {
      if (![ 400, 404, 409 ].includes(e.status)) {
        report(e);
      }
    }
    await loadChats();
    await loadChat(id);
  }

  function cancelRevert(id) {
    delete confirmations.value[id];
  }

  async function runRevert(id, requestId, cause) {
    const { revert } = await apos.http.post(`${getAction()}/chat/${id}/revert`, {
      body: {
        requestId,
        tabId: getTabId(),
        ...(cause && { cause })
      }
    });
    returning.add(revert._id);
  }

  /**
   * Runs a revert again: a failed one whole, a done one for the documents
   * that were locked. A refusal means the view was stale: the records are
   * read again.
   *
   * @param {string} id
   * @param {string} revertId
   */
  async function retryRevert(id, revertId) {
    // Its message returns only if its requests haven't left the thread yet
    const rewinds = (reverts.value[id]?.find(revert => revert._id === revertId)?.status === 'failed') &&
      !requests.value[id]?.some(request => request.revertId === revertId);
    try {
      await apos.http.post(`${getAction()}/chat/${id}/revert-retry`, {
        body: {
          revertId,
          tabId: getTabId()
        }
      });
      if (rewinds) {
        returning.add(revertId);
      }
    } catch (e) {
      if (![ 400, 404, 409 ].includes(e.status)) {
        report(e);
      }
    }
    await loadChats();
    await loadChat(id);
  }

  async function dismissRevert(id, revertId) {
    try {
      await apos.http.post(`${getAction()}/chat/${id}/revert-dismiss`, {
        body: { revertId }
      });
    } catch (e) {
      if (e.status !== 404) {
        report(e);
      }
    }
    await loadChat(id);
  }

  /**
   * Cancels the plan of the chat's open request: stops it, waits for it to
   * end, then reverts it as any revert, asking first when it isn't clean.
   *
   * @param {string} id
   * @param {string} requestId
   */
  async function cancelPlan(id, requestId) {
    try {
      await apos.http.post(`${getAction()}/chat/${id}/stop`, {
        body: { planCancel: true }
      });
    } catch (e) {
      if (![ 404, 409 ].includes(e.status)) {
        report(e);
      }
    }
    await loadChats();
    await loadChat(id);
    await new Promise((resolve) => {
      const open = () => getChat(id)?.openRequest?._id === requestId;
      if (!open()) {
        resolve();
        return;
      }
      const stop = watch(open, (still) => {
        if (!still) {
          stop();
          resolve();
        }
      });
    });
    if (getChat(id)) {
      await startRevert(id, requestId, { cause: 'planCancel' });
    }
  }

  function refuse(id, e) {
    const reason = e.body?.data?.reason;
    if (reason === 'otherBrowserTab') {
      // The chat tab shows the chat as read-only, which says it all
      return;
    }
    if (reason === 'requestOpen') {
      refusals.value[id] = {
        title: 'apostrophe:assistantStillRunning',
        text: 'apostrophe:assistantStillRunningText'
      };
      return;
    }
    if (reason === 'revertRunning') {
      refusals.value[id] = {
        title: 'apostrophe:assistantStillReverting',
        text: 'apostrophe:assistantStillRevertingText'
      };
      return;
    }
    if (e.status === 404) {
      // Deleted in another browser tab: the draft moves to a new chat
      const draft = drafts.value[id];
      forget(id);
      newChat();
      drafts.value[NEW_CHAT] = draft;
      refusals.value[NEW_CHAT] = {
        title: 'apostrophe:assistantChatDeleted'
      };
      return;
    }
    refusals.value[id] = {
      title: 'apostrophe:assistantNotSent',
      text: e.status
        ? 'apostrophe:assistantNotSentRefused'
        : 'apostrophe:assistantNotSentNoAnswer'
    };
  }

  /**
   * Pages, pieces and images matching the letters typed after `@`.
   *
   * @param {string} letters
   * @returns {Promise<object[]>} Each `{ _id, title, type, kind, label }`.
   */
  async function findMentions(letters) {
    const { results } = await apos.http.get(`${getAction()}/mention`, {
      qs: { q: letters }
    });
    return results;
  }

  function setDraft(id, text) {
    drafts.value[id] = text;
    delete refusals.value[id];
  }

  function restoreTabs() {
    let stored = null;
    try {
      stored = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY));
    } catch (e) {
      // A new set of chat tabs
    }
    if (!Array.isArray(stored?.tabs) ||
      !stored.tabs.every(id => typeof id === 'string')) {
      return;
    }
    tabs.value = stored.tabs.length ? stored.tabs : [ NEW_CHAT ];
    activeId.value = tabs.value.includes(stored.activeId)
      ? stored.activeId
      : tabs.value[0];
  }

  function rememberTabs() {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
        tabs: tabs.value,
        activeId: activeId.value
      }));
    } catch (e) {
      // The chat tabs last as long as the page
    }
  }

  function report(e) {
    // eslint-disable-next-line no-console
    console.error(e);
  }

  return {
    chats,
    loaded,
    requests,
    tabs,
    activeId,
    drafts,
    refusals,
    progress,
    reverts,
    revertProgress,
    confirmations,
    checking,
    browserSteps,
    getChat,
    getOwner,
    getBrowserStep,
    start,
    resume,
    catchUp,
    openChat,
    newChat,
    activate,
    closeTab,
    rename,
    remove,
    send,
    stop,
    continueHere,
    answer,
    skip,
    retry,
    startRevert,
    confirmRevert,
    cancelRevert,
    retryRevert,
    dismissRevert,
    cancelPlan,
    findMentions,
    setDraft
  };
});
