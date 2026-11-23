import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import { getTabId } from 'Modules/@apostrophecms/ui/utils';
import { createId } from 'apostrophe/lib/beneath.js';
import { getFirstTitle } from 'Modules/@apostrophecms/assistant/universal/message.js';
import { useScreen, isWindow } from 'Modules/@apostrophecms/ui/composables/useScreen.js';
import { useModalStore } from 'Modules/@apostrophecms/ui/stores/modal';
import { browserTools, releaseAhead } from '../lib/browser-tools.js';
import { createAttachments } from '../lib/attachments.js';

/**
 * The assistant's chats as this browser tab sees them. The records on the
 * server are the truth: they are read from the routes, and the
 * `assistant-chat` bus event says what changed. A request event sets its
 * chat's slot at once and reads that request alone; a chat event carries
 * the title. The whole chat is read when its chat tab opens, on catch-up
 * and after a revert; a step's arguments and result when the editor opens
 * the step. A missed event costs speed, never truth: coming back to the
 * browser tab reads it all.
 *
 * What the panel shows is the records with the editor's pending actions
 * folded over them (`getChat`, `getChats`, `getRequests`, `getReverts`):
 * an action shows its effect at the click and the server's answer settles
 * it (`act`). Components read only those getters. A read never undoes an
 * action: one in flight when an action starts or settles is dropped and
 * read again, and a chat with an action pending is never forgotten.
 *
 * The chat tabs are this browser tab's own, kept in session storage. The
 * browser names a new chat and each request; a new chat is created on the
 * server by its first send, so `NEW_CHAT` stands for the chat tab of a chat
 * not sent to yet.
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
 * the page enters edit mode, under any modal of the editor's.
 *
 * Revert takes back a request and every later one. A dry run decides: a
 * clean revert runs at once, any other waits on the editor's confirmation,
 * which is this page's alone and never stored. Once a revert this page
 * started is done, the reverted message returns to the composer.
 *
 * Continue in a new chat opens the new chat's tab at once, named by the
 * browser, and its thread shows the carry until the server says it is
 * done. A read of a chat's thread brings what only the thread shows (see
 * `THREAD_FIELDS`); the chat list doesn't, and a chat keeps the ones it
 * has.
 */

export const NEW_CHAT = 'new';

const STORAGE_KEY = 'aposAssistantTabs';
// The asks this browser tab answers on its own
const SERVED_KINDS = [ 'browser', 'editMode' ];
// Events arrive in bursts: one read per chat for each burst
const LOAD_DELAY = 50;
// A request not stored yet sorts last, where its record lands
const PENDING_SEQUENCE = Number.MAX_SAFE_INTEGER;
// What a read of a chat's thread brings and the chat list doesn't: the
// current summary, the carried one, the suggestion and the gauge's length.
// The length comes only while the chat is idle: a run holds the last one
const THREAD_FIELDS = [ 'summary', 'carriedSummary', 'suggestion', 'length' ];

export const useAssistantStore = defineStore('assistant', () => {
  const { getScreen } = useScreen();
  // The editor's chats, newest first
  const chats = ref([]);
  const loaded = ref(false);
  // The chat list could not be read, and was never read before
  const chatsFailed = ref(false);
  // Each loaded chat's requests in the order they were sent, by chat id
  const requests = ref({});
  // The chat tabs open in this browser tab, and the active one
  const tabs = ref([ NEW_CHAT ]);
  const activeId = ref(NEW_CHAT);
  // What the composer holds, by chat tab
  const drafts = ref({});
  // A prompt asked for from outside the panel, for the composer of the chat
  // tab it names to translate and put in: `{ chatId, key, count }`
  const askedPrompt = ref(null);
  // The editor's own action asks for the composer, taken once by it
  const composerFocus = ref(false);
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
  // What the editor did in this browser tab that the server hasn't answered
  // yet, by chat id, in the order clicked: `{ id, kind, key, data }`. Never
  // stored: the getters fold them over the records
  const actions = ref({});
  // The chats whose thread could not be read, by chat id
  const loadFailed = ref({});
  // The answers the server refused, by call id, given back to the ask
  const refusedAnswers = new Map();
  // The chat tabs' titles as last shown, for chat tabs not read yet
  const tabTitles = ref({});

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
  // Reads, actions and events take turns on one clock. A read is used only
  // if it is the latest of its target ('chats', a chat id, or `chat/request`
  // ids) and no action of its chat started or settled since it started: one
  // an action overtook is read again. Each record remembers when what last
  // set it happened, by key (`chat:id`, `request:id`, `revert:id`): a read
  // never replaces a record that an event, an answer or a later read set
  let clock = 0;
  const latest = new Map();
  const acted = new Map();
  let actedAny = 0;
  const stamps = new Map();
  // Each chat's actions on the wire, one at a time: the latest one's run
  const queues = new Map();
  // What events said while an action of their chat was on the wire, by
  // chat id: its answer may be older than what they said, so what it
  // disagrees with is read again once it settles. `{ requests, title,
  // whole }`, `requests` the last status heard by request id
  const heard = new Map();
  const pending = new Set();
  let timer = null;
  // The browser asks taken on this page, call id to request id: each runs
  // once. Forgotten once their request is no longer open
  const served = new Map();
  // The reverts this page started, whose message returns once done
  const returning = new Set();
  // The id the new chat's files upload to, named before the chat exists and
  // kept with the chat tabs, so a page load finds its files
  let newChatId = null;
  const attachments = createAttachments({
    getChatId: getUploadChatId,
    report
  });
  // The chat tabs whose send waits for their uploads
  const sendWaiting = ref({});

  function getAction() {
    return apos.modules['@apostrophecms/assistant'].action;
  }

  // A chat's record as the server last said it, or `null`
  function getChatRecord(id) {
    return chats.value.find(chat => chat._id === id) || null;
  }

  /**
   * A chat as the panel shows it: its record with this browser tab's
   * pending actions folded over it, or `null`.
   *
   * @param {string} id
   * @returns {object|null}
   */
  function getChat(id) {
    return fold(id).chat;
  }

  /**
   * The editor's chats as the panel shows them, newest first: a chat this
   * browser tab is creating comes first.
   *
   * @returns {object[]}
   */
  function getChats() {
    const known = new Set(chats.value.map(chat => chat._id));
    const created = Object.keys(actions.value).filter(id => !known.has(id));
    return [ ...created, ...known ].map(getChat).filter(Boolean);
  }

  /**
   * A chat's requests as the panel shows them, in the order they were sent.
   *
   * @param {string} id
   * @returns {object[]}
   */
  function getRequests(id) {
    return fold(id).requests;
  }

  /**
   * A chat's reverts as the panel shows them, in the order they were made.
   *
   * @param {string} id
   * @returns {object[]}
   */
  function getReverts(id) {
    return fold(id).reverts;
  }

  /**
   * Whether an action of this kind is pending on the chat, and with `key`,
   * the one for that key (a request, a revert, a call).
   *
   * @param {string} id
   * @param {string} kind
   * @param {*} [key]
   * @returns {boolean}
   */
  function isPending(id, kind, key) {
    return (actions.value[id] || []).some(action => (action.kind === kind) &&
      ((key === undefined) || (action.key === key)));
  }

  /**
   * Whether a chat's thread is read: `ready`, `loading`, or `failed` when
   * it could not be read (`loadChat` tries again). A new chat, and one with
   * an action pending, are ready.
   *
   * @param {string} id
   * @returns {'ready'|'loading'|'failed'}
   */
  function getThreadState(id) {
    if ((id === NEW_CHAT) || requests.value[id] || actions.value[id]) {
      return 'ready';
    }
    return loadFailed.value[id] ? 'failed' : 'loading';
  }

  /**
   * A chat tab's title: the chat's, else the one it last showed while the
   * chat is read, else `null` (a new chat).
   *
   * @param {string} id
   * @returns {string|null}
   */
  function getTabTitle(id) {
    if (id === NEW_CHAT) {
      return null;
    }
    return getChat(id)?.title || tabTitles.value[id] || null;
  }

  /**
   * The answers given to an ask that the server refused, once: the ask shows
   * them again.
   *
   * @param {string} callId
   * @returns {object|null}
   */
  function takeRefusedAnswer(callId) {
    const value = refusedAnswers.get(callId) || null;
    refusedAnswers.delete(callId);
    return value;
  }

  // The chat's records with its pending actions applied in the order they
  // were clicked
  function fold(id) {
    let view = {
      chat: getChatRecord(id),
      requests: requests.value[id] || [],
      reverts: reverts.value[id] || []
    };
    for (const action of actions.value[id] || []) {
      view = folds[action.kind]?.(view, action) || view;
    }
    return view;
  }

  // How a pending action changes what the panel shows, by kind
  const folds = {
    send: foldSend,
    retry: foldSend,
    stop: foldStop,
    answer: foldAnswer,
    skip: foldSkip,
    continueHere: foldContinueHere,
    revert: foldRevert,
    retryRevert: foldRetryRevert,
    dismissRevert: foldDismissRevert,
    rename: foldRename,
    delete: foldDelete,
    continue: foldContinue,
    dismissSuggestion: foldDismissSuggestion,
    noticeAction: foldNoticeAction
  };

  // The chat's open request changed in the chat and in its record, when
  // its status is one of `statuses`
  function changeOpen(view, statuses, change) {
    const open = view.chat?.openRequest;
    if (!open || !statuses.includes(open.status)) {
      return view;
    }
    const request = view.requests.find(each => each._id === open._id);
    const changed = change(request || {
      _id: open._id,
      status: open.status,
      tabId: open.tabId
    });
    return {
      ...view,
      chat: {
        ...view.chat,
        openRequest: [ 'running', 'waiting', 'stopping' ].includes(changed.status)
          ? {
            ...open,
            status: changed.status,
            tabId: changed.tabId
          }
          : null
      },
      requests: view.requests.map(each => ((each._id === open._id) ? changed : each))
    };
  }

  // A stop on its way: the open request reads "Stopping…" until it ends,
  // and a cancelled plan reads cancelling
  function foldStop(view, { data }) {
    return changeOpen(view, [ 'running', 'waiting' ], request => ({
      ...request,
      status: 'stopping',
      ...(data?.planCancel && { planCancelled: true })
    }));
  }

  // An answer on its way: the ask leaves, and the request goes on
  function foldAnswer(view, { key, data }) {
    return changeOpen(view, [ 'waiting' ], (request) => {
      const answered = (request.asks || []).find(ask => ask.callId === key);
      const asks = (request.asks || []).filter(ask => ask.callId !== key);
      return {
        ...request,
        asks,
        ...((answered?.kind === 'images') && {
          imageAsks: foldImageAnswer(request.imageAsks || [], answered, data?.value)
        }),
        status: asks.length ? request.status : 'running'
      };
    });
  }

  // An image round answered: Refine's notes beside the image kept for
  // them, Try again's round, or the outcome, the picked image shown as used
  // until Media has it
  function foldImageAnswer(imageAsks, ask, value) {
    const option = ask.payload.candidates
      .findIndex(candidate => candidate._id === value?.candidate) + 1;
    return imageAsks.map((each) => {
      if (each.callId !== ask.callId) {
        return each;
      }
      if ([ 'refine', 'again' ].includes(value?.action)) {
        return {
          ...each,
          rounds: [ ...each.rounds, {
            action: value.action,
            notes: value.notes || null,
            kept: (value.action === 'refine') ? (value.candidate || null) : null
          } ]
        };
      }
      return {
        ...each,
        outcome: {
          action: value?.action,
          ...(option && {
            option,
            candidate: value.candidate
          })
        }
      };
    });
  }

  // A skip on its way: the request ends skipped and the composer is free
  function foldSkip(view) {
    return changeOpen(view, [ 'waiting' ], request => ({
      ...request,
      asks: [],
      status: 'skipped'
    }));
  }

  // Continue here on its way: this browser tab owns the request
  function foldContinueHere(view) {
    return changeOpen(view, [ 'waiting' ], request => ({
      ...request,
      tabId: getTabId()
    }));
  }

  // A revert on its way runs at once: its line where the requests it takes
  // were, and Send waits. A revert the records hold now settles it
  function foldRevert(view, { data }) {
    if (view.reverts.some(revert => !data.before.includes(revert._id))) {
      return view;
    }
    return {
      ...view,
      chat: view.chat && {
        ...view.chat,
        openRevert: { _id: data.revertId }
      },
      reverts: [
        ...view.reverts,
        {
          _id: data.revertId,
          chatId: data.chatId,
          requestIds: data.requestIds,
          cause: data.cause,
          status: 'running',
          progress: null,
          documents: [],
          pending: true
        }
      ]
    };
  }

  // A revert run again: running from the click
  function foldRetryRevert(view, { key }) {
    return {
      ...view,
      chat: view.chat && {
        ...view.chat,
        openRevert: { _id: key }
      },
      reverts: view.reverts.map(revert => ((revert._id === key)
        ? {
          ...revert,
          status: 'running'
        }
        : revert))
    };
  }

  function foldDismissRevert(view, { key }) {
    return {
      ...view,
      reverts: view.reverts.map(revert => ((revert._id === key)
        ? {
          ...revert,
          dismissed: true
        }
        : revert))
    };
  }

  function foldRename(view, { data }) {
    return {
      ...view,
      chat: view.chat && {
        ...view.chat,
        title: data.title
      }
    };
  }

  // A new chat on its way, or its failed carry started again: carrying from
  // the click
  function foldContinue(view, { data }) {
    return {
      ...view,
      chat: {
        ...(view.chat || {
          _id: data.chatId,
          title: null,
          openRequest: null,
          openRevert: null,
          continuedFrom: data.continuedFrom,
          createdAt: data.createdAt
        }),
        carry: { status: 'running' }
      }
    };
  }

  function foldDismissSuggestion(view, { key }) {
    return (view.chat?.suggestion?._id === key)
      ? {
        ...view,
        chat: {
          ...view.chat,
          suggestion: null
        }
      }
      : view;
  }

  function foldDelete(view) {
    return {
      chat: null,
      requests: [],
      reverts: []
    };
  }

  // A message on its way: this browser tab's running request at the end of
  // the thread, in a chat that exists from the click. Its record settles
  // it, whichever brings it first: the answer or a read
  function foldSend(view, { data }) {
    if (view.requests.some(request => request._id === data.requestId)) {
      return view;
    }
    const chat = view.chat || {
      _id: data.chatId,
      title: data.title,
      openRequest: null,
      openRevert: null,
      createdAt: data.createdAt
    };
    return {
      ...view,
      chat: {
        ...chat,
        openRequest: {
          _id: data.requestId,
          tabId: getTabId(),
          status: 'running'
        }
      },
      requests: [
        ...view.requests,
        {
          _id: data.requestId,
          chatId: data.chatId,
          tabId: getTabId(),
          message: data.message,
          ...(data.retryOf && { retryOf: data.retryOf }),
          attachments: data.attachments || [],
          unavailable: [],
          status: 'running',
          sequence: PENDING_SEQUENCE,
          asks: null,
          pending: true
        }
      ]
    };
  }

  // A notice's button on its way: busy, and its request runs at the end of
  // the thread until its record settles it
  function foldNoticeAction(view, { data }) {
    const taken = view.requests.map(request => ((request._id === data.requestId)
      ? markNoticeAction(request, data.noticeId, action => action && {
        ...action,
        pending: true
      })
      : request));
    if (view.requests.some(request => request.action?.noticeId === data.noticeId)) {
      return {
        ...view,
        requests: taken
      };
    }
    const _id = `pending-${data.noticeId}`;
    return {
      ...view,
      chat: view.chat && {
        ...view.chat,
        openRequest: view.chat.openRequest || {
          _id,
          tabId: getTabId(),
          status: 'running'
        }
      },
      requests: [
        ...taken,
        {
          _id,
          chatId: view.chat?._id,
          tabId: getTabId(),
          message: '',
          action: {
            name: data.name,
            requestId: data.requestId,
            noticeId: data.noticeId
          },
          attachments: [],
          unavailable: [],
          notices: [],
          status: 'running',
          sequence: PENDING_SEQUENCE,
          asks: null,
          pending: true
        }
      ]
    };
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
      attachments.loadAttached(activeId.value);
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
      watch(() => {
        const { modals, window } = getScreen();
        return JSON.stringify([ modals, window ]);
      }, postScreen);
    }
    await catchUp();
  }

  // While it owns an open request, the browser tab posts its screen when its
  // modals or its window change: the server never writes a document an
  // editor opened meanwhile
  async function postScreen() {
    if (!chats.value.some(chat => getOwner(chat) === 'here')) {
      return;
    }
    try {
      await apos.http.post(`${getAction()}/screen`, {
        body: {
          tabId: getTabId(),
          screen: getScreen()
        }
      });
    } catch (e) {
      // The next message or answer reports the screen again
    }
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
    if (actions.value[chatId] && [ 'chat', 'request', 'revert' ].includes(stage)) {
      hear(chatId, event);
    }
    if (stage === 'chat') {
      applyTitle(chatId, event.title ?? null);
      return;
    }
    if (stage === 'request') {
      delete progress.value[requestId];
      applyRequest(event);
      return;
    }
    if (stage === 'revert') {
      // A revert changes the chat's slot and several of its requests
      delete revertProgress.value[event.revertId];
      if (requests.value[chatId]) {
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
    } else if (stage === 'summary') {
      progress.value[requestId] = { label: 'apostrophe:assistantSummarizing' };
    } else if (stage === 'carry') {
      applyCarry(chatId, event.status);
    } else if (stage === 'suggestion') {
      const chat = getChatRecord(chatId);
      if (chat?.suggestion?._id === event.dismissed) {
        setChat({
          ...chat,
          suggestion: null
        });
      }
    }
  }

  // A carry's end, set at once; the chat is read for what it carried over
  function applyCarry(id, status) {
    const chat = getChatRecord(id);
    if (!chat) {
      if (!actions.value[id]) {
        schedule('chats');
      }
      return;
    }
    stamps.set(`chat:${id}`, ++clock);
    setChat({
      ...chat,
      carry: (status === 'done') ? null : { status }
    });
    schedule(id);
  }

  function hear(id, {
    stage, requestId, status, title
  }) {
    const missed = heard.get(id) || {
      requests: new Map(),
      title: undefined,
      whole: false
    };
    if (stage === 'request') {
      missed.requests.set(requestId, status);
    } else if (stage === 'chat') {
      missed.title = title ?? null;
    } else {
      missed.whole = true;
    }
    heard.set(id, missed);
  }

  // A chat event's title, set at once. A chat not known here is read with
  // the chat list
  function applyTitle(id, title) {
    const chat = getChatRecord(id);
    if (!chat) {
      if (!actions.value[id]) {
        schedule('chats');
      }
      return;
    }
    stamps.set(`chat:${id}`, ++clock);
    setChat({
      ...chat,
      title
    });
  }

  // A request event's status, set at once on its chat's slot while the
  // request is open. An ended one keeps its running look until its read
  // lands, so the thread never shows it ended without its reply; a chat
  // whose thread isn't read only frees its slot. The request is read where
  // its thread is, and read whole where this browser tab answers its asks
  function applyRequest({
    chatId: id, requestId, status, tabId
  }) {
    const chat = getChatRecord(id);
    const loaded = Boolean(requests.value[id]);
    const open = [ 'running', 'waiting', 'stopping' ].includes(status);
    const same = chat?.openRequest?._id === requestId;
    if (chat && (open || (!loaded && same))) {
      stamps.set(`chat:${id}`, ++clock);
      setChat({
        ...chat,
        openRequest: open
          ? {
            ...(same && chat.openRequest),
            _id: requestId,
            status,
            tabId
          }
          : null
      });
    }
    if (loaded) {
      schedule(`${id}/${requestId}`);
    } else if (!chat) {
      if (!actions.value[id]) {
        schedule('chats');
      }
    } else if ((status === 'waiting') && (tabId === getTabId())) {
      schedule(id);
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
        } else if (target.includes('/')) {
          const [ id, requestId ] = target.split('/');
          loadRequest(id, requestId);
        } else {
          loadChat(target);
        }
      }
    }, LOAD_DELAY);
  }

  // A read of `target` starts: its tick
  function startRead(target) {
    const tick = ++clock;
    latest.set(target, tick);
    return tick;
  }

  // Whether a read's answer may be used: the latest of its target, and no
  // action of its chat (of any chat for the list) since it started. One an
  // action overtook is read again
  function isCurrent(target, id, tick) {
    if (latest.get(target) !== tick) {
      return false;
    }
    if (((id ? acted.get(id) : actedAny) || 0) > tick) {
      schedule(target);
      return false;
    }
    return true;
  }

  // Whether a read started at `tick` may set the record `key`: nothing set
  // it later. If so, the record is now the read's
  function take(key, tick) {
    if ((stamps.get(key) || 0) > tick) {
      return false;
    }
    stamps.set(key, tick);
    return true;
  }

  // A thread's records as a read brings them, but for any record something
  // later set, which stays as it is, listed or not
  function merge(kind, current = [], read, tick) {
    const byId = new Map(current.map(each => [ each._id, each ]));
    const listed = new Set(read.map(each => each._id));
    return [
      ...read.map(each => (take(`${kind}:${each._id}`, tick) ? each : (byId.get(each._id) || each))),
      ...current.filter(each => !listed.has(each._id) &&
        ((stamps.get(`${kind}:${each._id}`) || 0) > tick))
    ];
  }

  async function loadChats() {
    const tick = startRead('chats');
    let result;
    chatsFailed.value = false;
    try {
      result = await apos.http.get(`${getAction()}/chat`, {});
    } catch (e) {
      report(e);
      chatsFailed.value = !loaded.value && (latest.get('chats') === tick);
      return;
    }
    if (!isCurrent('chats', null, tick)) {
      return;
    }
    // Newest first, as the server lists them, each keeping what its thread
    // read brought
    const before = new Map(chats.value.map(chat => [ chat._id, chat ]));
    chats.value = merge('chat', chats.value, result.chats, tick)
      .map(chat => keepThreadFields(chat, before.get(chat._id)))
      .sort((one, two) => String(two.createdAt).localeCompare(String(one.createdAt)));
    loaded.value = true;
    rememberTabs();
    const open = new Set(chats.value.map(chat => chat.openRequest?._id));
    for (const [ callId, requestId ] of served) {
      if (!open.has(requestId)) {
        served.delete(callId);
      }
    }
    for (const id of tabs.value) {
      if ((id !== NEW_CHAT) && !getChatRecord(id) && !actions.value[id]) {
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
    const tick = startRead(id);
    delete loadFailed.value[id];
    let result;
    try {
      result = await apos.http.get(`${getAction()}/chat/${id}`, {});
    } catch (e) {
      // Not created yet, or deleted here: its action settles it
      if ((e.status === 404) && !actions.value[id]) {
        forget(id);
      } else if (e.status !== 404) {
        report(e);
        if (latest.get(id) === tick) {
          loadFailed.value[id] = true;
        }
      }
      return;
    }
    if (!isCurrent(id, id, tick)) {
      return;
    }
    if (take(`chat:${id}`, tick)) {
      setChat(result.chat);
    }
    requests.value[id] = merge('request', requests.value[id], result.requests, tick)
      .sort((one, two) => one.sequence - two.sequence);
    for (const request of requests.value[id]) {
      if (![ 'running', 'waiting', 'stopping' ].includes(request.status)) {
        releaseAhead(request._id);
      }
    }
    reverts.value[id] = merge('revert', reverts.value[id], result.reverts, tick);
    returnMessages(id);
    serveAsks(id);
  }

  // A request and its chat, after a request event. A thread not read yet is
  // read whole
  async function loadRequest(id, requestId) {
    if (!requests.value[id]) {
      return loadChat(id);
    }
    const target = `${id}/${requestId}`;
    const tick = startRead(target);
    let result;
    try {
      result = await getRequest(id, requestId);
    } catch (e) {
      // Gone with its chat: the chat's read says so
      if (e.status === 404) {
        schedule(id);
      } else {
        report(e);
      }
      return;
    }
    if (!isCurrent(target, id, tick)) {
      return;
    }
    if (take(`chat:${id}`, tick)) {
      setChat(result.chat);
    }
    // Its chat tab may have closed meanwhile
    if (requests.value[id] && take(`request:${requestId}`, tick)) {
      setRequest(result.request);
    }
    serveAsks(id);
  }

  function getRequest(id, requestId) {
    return apos.http.get(`${getAction()}/chat/${id}/request/${requestId}`, {});
  }

  /**
   * A step's arguments and result, or error, read when the editor opens it:
   * `{ input, output, error }`, each text or `null`.
   *
   * @param {string} id
   * @param {string} requestId
   * @param {string} stepId
   * @returns {Promise<object>}
   */
  function loadStep(id, requestId, stepId) {
    return apos.http.get(
      `${getAction()}/chat/${id}/request/${requestId}/step/${encodeURIComponent(stepId)}`,
      {}
    );
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
        prependDraft(id, message);
      }
    }
  }

  // The browser asks of the chat's request, when this browser tab owns it
  function serveAsks(id) {
    const chat = getChatRecord(id);
    if ((getOwner(chat) !== 'here') || (chat.openRequest.status !== 'waiting')) {
      return;
    }
    const request = requests.value[id]?.find(each => each._id === chat.openRequest._id);
    for (const ask of request?.asks || []) {
      if (!SERVED_KINDS.includes(ask.kind) || served.has(ask.callId)) {
        continue;
      }
      served.set(ask.callId, request._id);
      serveAsk(id, request, ask);
    }
  }

  // Waits for the ask's turn, runs the executor and answers, in the chat's
  // queue with the editor's own actions. An ask that is no longer this
  // browser tab's is left; an answer the server didn't take is given up,
  // the reason in the console: the editor can still stop the request. One
  // that never arrived, or arrived after the request moved to another
  // browser tab, is served again if the records show it here
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
      await act('answer', id, {
        key: ask.callId,
        byEditor: false,
        post: () => apos.http.post(`${getAction()}/chat/${id}/answer`, {
          body: {
            tabId: getTabId(),
            callId: ask.callId,
            answer,
            screen: getScreen()
          }
        }),
        refused(e) {
          if (!e.status || (e.status === 409)) {
            served.delete(ask.callId);
          } else {
            report(e);
          }
        }
      });
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

      // A step the editor stopped never starts
      function getTurn() {
        if (!isServed(id, request._id, ask.callId) || isPending(id, 'stop')) {
          return { state: 'gone' };
        }
        if (!visible.value) {
          return { state: 'hidden' };
        }
        if (changes && (activeId.value !== id)) {
          return { state: 'attention' };
        }
        const holder = changes
          ? getHolder(request._id, { modals: ask.kind !== 'editMode' })
          : null;
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
          release,
          stopped: () => isPending(id, 'stop') || !isServed(id, request._id, callId)
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
    const chat = getChatRecord(id);
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
   * @param {object} [options]
   * @param {boolean} [options.modals] Whether the editor's own modals hold
   *   it.
   * @returns {object|null}
   */
  function getHolder(requestId, { modals = true } = {}) {
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
      if (modals) {
        return { modal: entry.screen?.kind || 'other' };
      }
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
      chats.value.splice(index, 1, keepThreadFields(chat, chats.value[index]));
    }
  }

  function keepThreadFields(chat, earlier) {
    if (!earlier || (earlier === chat)) {
      return chat;
    }
    const kept = { ...chat };
    for (const field of THREAD_FIELDS) {
      if (!(field in kept) && (field in earlier)) {
        kept[field] = earlier[field];
      }
    }
    return kept;
  }

  // A chat that is gone: deleted here, in another browser tab, or not found
  function forget(id) {
    chats.value = chats.value.filter(chat => chat._id !== id);
    delete requests.value[id];
    delete reverts.value[id];
    delete confirmations.value[id];
    delete refusals.value[id];
    attachments.forgetAttached(id);
    if (tabs.value.includes(id)) {
      closeTab(id);
    }
  }

  /**
   * Whether files may be attached in a chat tab now: never by a user who
   * may not upload files, nor while its chat has a request or a revert
   * open, waits for what it carries over, or a revert waits on its
   * confirmation, nor past `attachmentMaxCount`.
   *
   * @param {string} id
   * @returns {boolean}
   */
  function canAttach(id) {
    const chat = getChat(id);
    return attachments.canUpload() && (getOwner(chat) === 'none') && !chat?.openRevert &&
      !chat?.carry && !confirmations.value[id] && !attachments.isFull(id);
  }

  function getUploadChatId(id, { create = true } = {}) {
    if (id !== NEW_CHAT) {
      return id;
    }
    if (!newChatId && create) {
      newChatId = createId();
      rememberTabs();
    }
    return newChatId;
  }

  // A chat tab opened comes first; an empty new chat in front gives way to
  // it. One already open stays where it is
  function openChat(id) {
    if (!tabs.value.includes(id)) {
      const blank = (activeId.value === NEW_CHAT) && !drafts.value[NEW_CHAT]?.trim() &&
        !attachments.getAttached(NEW_CHAT).length;
      if (blank) {
        tabs.value.splice(tabs.value.indexOf(NEW_CHAT), 1);
        delete refusals.value[NEW_CHAT];
      }
      tabs.value.unshift(id);
    }
    activate(id);
  }

  function newChat() {
    if (!tabs.value.includes(NEW_CHAT)) {
      tabs.value.unshift(NEW_CHAT);
    }
    activate(NEW_CHAT);
  }

  function activate(id) {
    activeId.value = id;
    rememberTabs();
    attachments.loadAttached(id);
    if (id !== NEW_CHAT) {
      loadChat(id);
    }
  }

  // The chat tab to the right of a closed active one takes its place, else
  // the one to its left, else a new chat. A continued chat whose carry
  // failed is dropped with its chat tab
  function closeTab(id) {
    const index = tabs.value.indexOf(id);
    if (index === -1) {
      return;
    }
    if (getChat(id)?.carry?.status === 'failed') {
      remove(id);
      return;
    }
    tabs.value.splice(index, 1);
    if (id === NEW_CHAT) {
      delete drafts.value[NEW_CHAT];
      delete refusals.value[NEW_CHAT];
      attachments.discardAttached(NEW_CHAT);
      newChatId = null;
    } else if (getOwner(getChatRecord(id)) !== 'here') {
      // Its thread is read again when it opens; a request this browser tab
      // runs keeps it meanwhile
      delete requests.value[id];
      delete reverts.value[id];
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

  /**
   * Runs an action of the editor's on a chat. It shows at once (`folds`),
   * is posted once the chat's earlier actions are answered, and the
   * server's answer settles it in one tick. Taken: the answer goes into the
   * records. Refused, or no answer: the view is the records again, which are
   * read again since the view was stale. The same action already pending is
   * ignored.
   *
   * @param {string} kind
   * @param {string} id The chat's id.
   * @param {object} options
   * @param {Function} options.post Posts it; resolves with the route's
   *   answer.
   * @param {*} [options.key] Tells two actions of a kind apart.
   * @param {object} [options.data] What its fold shows.
   * @param {Function} [options.taken] Called with the answer, in the tick
   *   it settles.
   * @param {Function} [options.refused] Called with the error, in the tick
   *   it settles: says why.
   * @param {Function} [options.check] On no answer, resolves with what the
   *   server stored meanwhile as an answer, or `null`.
   * @param {boolean} [options.byEditor] The editor's click, which clears why
   *   the chat tab's last action didn't go through; `false` for this
   *   browser tab's own answers to browser asks.
   * @returns {Promise<{ taken: boolean, answer?: object, error?: Error }>}
   */
  function act(kind, id, {
    post, key = null, data = null, taken = null, refused = report, check = null,
    byEditor = true
  }) {
    const pending = actions.value[id] || [];
    if (pending.some(action => (action.kind === kind) && (action.key === key))) {
      return Promise.resolve({ taken: false });
    }
    if (byEditor) {
      delete refusals.value[id];
    }
    const action = {
      id: createId(),
      kind,
      key,
      data
    };
    actions.value = {
      ...actions.value,
      [id]: [ ...pending, action ]
    };
    bump(id);
    const run = (queues.get(id) || Promise.resolve()).then(async () => {
      let answer;
      try {
        answer = await post();
      } catch (error) {
        answer = (!error.status && check) ? await check().catch(() => null) : null;
        if (!answer) {
          drop(id, action);
          refused(error);
          schedule(id);
          return {
            taken: false,
            error
          };
        }
      }
      applyAnswer(answer);
      taken?.(answer);
      drop(id, action);
      return {
        taken: true,
        answer
      };
    }).catch((error) => {
      report(error);
      return {
        taken: false,
        error
      };
    });
    queues.set(id, run);
    return run;
  }

  // An action started or settled: reads in flight are dropped, and read
  // again
  function bump(id) {
    const tick = ++clock;
    acted.set(id, tick);
    actedAny = tick;
  }

  // By its id: what the ref gives back is a reactive copy, never the action
  function drop(id, action) {
    const rest = (actions.value[id] || []).filter(each => each.id !== action.id);
    const { [id]: ignored, ...others } = actions.value;
    actions.value = rest.length
      ? {
        ...others,
        [id]: rest
      }
      : others;
    bump(id);
    // The server changed the chat meanwhile: its answer may be older than
    // what the events said. What the answer agrees with needs no read
    const missed = heard.get(id);
    heard.delete(id);
    if (!missed) {
      return;
    }
    const title = (missed.title !== undefined) &&
      ((getChatRecord(id)?.title ?? null) !== missed.title);
    if (missed.whole || title) {
      schedule(id);
      return;
    }
    for (const [ requestId, status ] of missed.requests) {
      const record = requests.value[id]?.find(request => request._id === requestId);
      if (requests.value[id] && (record?.status !== status)) {
        schedule(`${id}/${requestId}`);
      }
    }
  }

  // A route's answer into the records: the chat, the request or the revert
  // as the action left them, newer than any read in flight
  function applyAnswer({
    chat, request, revert
  } = {}) {
    const tick = ++clock;
    if (chat) {
      stamps.set(`chat:${chat._id}`, tick);
      setChat(chat);
    }
    if (request) {
      stamps.set(`request:${request._id}`, tick);
      setRequest(request);
    }
    if (revert) {
      stamps.set(`revert:${revert._id}`, tick);
      setRevert(revert);
    }
    const chatId = chat?._id || request?.chatId;
    if (chatId) {
      serveAsks(chatId);
    }
  }

  function setRequest(request) {
    const list = (requests.value[request.chatId] || [])
      .filter(each => each._id !== request._id);
    const index = list.findIndex(each => each.sequence > request.sequence);
    list.splice((index === -1) ? list.length : index, 0, request);
    requests.value[request.chatId] = list;
    if (![ 'running', 'waiting', 'stopping' ].includes(request.status)) {
      releaseAhead(request._id);
    }
  }

  function setRevert(revert) {
    const list = reverts.value[revert.chatId] || [];
    const index = list.findIndex(each => each._id === revert._id);
    reverts.value[revert.chatId] = (index === -1)
      ? [ ...list, revert ]
      : list.map(each => ((each._id === revert._id) ? revert : each));
  }

  // The request the browser named, if the server stored it: an answer that
  // never arrived may still have been taken
  async function findSent(id, requestId) {
    try {
      return await getRequest(id, requestId);
    } catch (e) {
      if (e.status === 404) {
        return null;
      }
      throw e;
    }
  }

  /**
   * Renames a chat: the new title shows at once, and the old one returns if
   * the server doesn't take it.
   *
   * @param {string} id
   * @param {string} title
   * @returns {Promise<null|'noAnswer'>} Why it didn't go through, if it
   *   didn't and the editor has no other sign of it.
   */
  async function rename(id, title) {
    const { taken, error } = await act('rename', id, {
      key: title,
      data: { title },
      post: () => apos.http.patch(`${getAction()}/chat/${id}`, {
        body: { title }
      }),
      refused: e => fail(id, e, { dock: false })
    });
    return (!taken && error && !error.status) ? 'noAnswer' : null;
  }

  /**
   * Deletes a chat: its row and its chat tab leave at once, and return
   * where they were if the server doesn't take it.
   *
   * @param {string} id
   * @returns {Promise<null|'running'|'noAnswer'>} Why it didn't go through:
   *   the chat runs (the view was stale), or no answer came.
   */
  async function remove(id) {
    const index = tabs.value.indexOf(id);
    const active = activeId.value === id;
    const result = act('delete', id, {
      post: () => apos.http.delete(`${getAction()}/chat/${id}`, {}),
      taken: () => forget(id),
      refused(e) {
        if ((e.status !== 404) && (index !== -1) && !tabs.value.includes(id)) {
          tabs.value.splice(Math.min(index, tabs.value.length), 0, id);
          if (active) {
            activate(id);
          } else {
            rememberTabs();
          }
        }
        fail(id, e, { dock: false });
      }
    });
    if (index !== -1) {
      closeTab(id);
    }
    const { taken, error } = await result;
    if (taken || !error || (error.status === 404)) {
      return null;
    }
    return error.status ? 'running' : 'noAnswer';
  }

  /**
   * Sends the draft of a chat tab, or `message` with the draft left as it
   * is. The message shows at once as a running request and the composer
   * empties; a first send creates its chat, whose chat tab is the chat's
   * own from the click. A refused send is taken back: the text returns to
   * the composer, in front of anything typed since, and the chat tab says
   * why.
   *
   * @param {string} id A chat id, or `NEW_CHAT`.
   * @param {object} [options]
   * @param {string} [options.message]
   */
  async function send(id, { message: given = null } = {}) {
    if (!(given ?? drafts.value[id] ?? '').trim()) {
      return;
    }
    // Pressed while files upload: it goes once they are stored, with the
    // draft as it is then
    if (attachments.isUploading(id)) {
      if (!sendWaiting.value[id]) {
        sendWaiting.value[id] = true;
        await attachments.whenUploaded(id);
        delete sendWaiting.value[id];
        await send(id, { message: given });
      }
      return;
    }
    const message = (given ?? drafts.value[id] ?? '').trim();
    if (!message) {
      return;
    }
    const create = id === NEW_CHAT;
    const chatId = create ? (newChatId || createId()) : id;
    if (create) {
      newChatId = null;
    }
    const requestId = createId();
    const taken = attachments.takeAttached(id);
    delete refusals.value[id];
    if (given === null) {
      delete drafts.value[id];
    }
    if (create) {
      tabs.value.splice(tabs.value.indexOf(NEW_CHAT), 1, chatId);
      if (activeId.value === NEW_CHAT) {
        activeId.value = chatId;
      }
      rememberTabs();
    }
    await act('send', chatId, {
      data: {
        chatId,
        requestId,
        message,
        attachments: taken.map(file => file.attachment),
        title: create ? getFirstTitle(message) : null,
        createdAt: new Date().toISOString()
      },
      post: () => apos.http.post(`${getAction()}/chat/${chatId}/send`, {
        body: {
          message,
          screen: getScreen(),
          requestId,
          ...(taken.length && { attachments: taken.map(file => file.attachment._id) }),
          ...(create && { create })
        }
      }),
      check: () => findSent(chatId, requestId),
      refused(e) {
        // A new chat that never was: its chat tab is New chat again, its
        // files still uploaded under its id
        const target = create ? NEW_CHAT : chatId;
        if (!create || !newChatId) {
          newChatId = create ? chatId : newChatId;
          attachments.giveBack(target, taken);
        }
        if (create) {
          const index = tabs.value.indexOf(chatId);
          if (tabs.value.includes(NEW_CHAT)) {
            tabs.value.splice(index, 1);
          } else {
            tabs.value.splice(index, 1, NEW_CHAT);
          }
          if (activeId.value === chatId) {
            activeId.value = NEW_CHAT;
          }
          rememberTabs();
        }
        if (given === null) {
          prependDraft(target, message);
        }
        if (e.body?.data?.reason === 'gone') {
          attachments.loadAttached(target, { again: true });
        }
        refuse(target, e);
      }
    });
  }

  /**
   * Stops the chat's open request, running or waiting. Any browser tab may
   * stop it; a stop the server refuses means the view was stale, and
   * reading the records again shows what is true now.
   *
   * @param {string} id
   * @param {object} [options]
   * @param {boolean} [options.planCancel] The editor cancelled the
   *   request's plan.
   */
  async function stop(id, { planCancel = false } = {}) {
    const { taken } = await act('stop', id, {
      data: { planCancel },
      post: () => apos.http.post(`${getAction()}/chat/${id}/stop`, {
        body: planCancel ? { planCancel } : {}
      }),
      refused: e => fail(id, e)
    });
    return taken;
  }

  /**
   * Makes this browser tab the owner of the chat's waiting request, with
   * its screen: from then on it answers the request's asks. A refusal
   * means the view was stale: the records are read again.
   *
   * @param {string} id
   */
  async function continueHere(id) {
    await act('continueHere', id, {
      post: () => apos.http.post(`${getAction()}/chat/${id}/continue-here`, {
        body: {
          tabId: getTabId(),
          screen: getScreen()
        }
      }),
      // Its dock returns, which says it
      refused: e => fail(id, e, { dock: false })
    });
  }

  /**
   * Answers the editor's ask of the chat's waiting request from this
   * browser tab, with its screen as it is now. The ask leaves at once; if
   * the server doesn't take the answer, the records say whether it still
   * waits, and then it shows the answers given (`takeRefusedAnswer`).
   *
   * @param {string} id
   * @param {string} callId The tool call that asked.
   * @param {object} value What the ask's kind takes.
   * @returns {Promise<boolean>} Whether the server took it.
   */
  async function answer(id, callId, value) {
    const { taken } = await act('answer', id, {
      key: callId,
      data: { value },
      post: () => apos.http.post(`${getAction()}/chat/${id}/answer`, {
        body: {
          tabId: getTabId(),
          callId,
          answer: value,
          screen: getScreen()
        }
      }),
      // The ask returns, which says it
      refused(e) {
        refusedAnswers.set(callId, value);
        fail(id, e, { dock: false });
      }
    });
    return taken;
  }

  /**
   * Skips the questions of the chat's waiting request, which ends it. A
   * refusal means the view was stale: the records are read again.
   *
   * @param {string} id
   */
  async function skip(id) {
    await act('skip', id, {
      post: () => apos.http.post(`${getAction()}/chat/${id}/skip`, {
        body: { tabId: getTabId() }
      }),
      refused: e => fail(id, e, { dock: false })
    });
  }

  /**
   * Sends the chat's failed latest request again, as a new request under
   * the same message. A refusal says why on the chat tab, as a refused send
   * does.
   *
   * @param {string} id
   * @param {string} failedId
   */
  async function retry(id, failedId) {
    const requestId = createId();
    delete refusals.value[id];
    await act('retry', id, {
      data: {
        chatId: id,
        requestId,
        message: requests.value[id]?.find(request => request._id === failedId)?.message || '',
        attachments: requests.value[id]?.find(request => request._id === failedId)
          ?.attachments || [],
        retryOf: failedId
      },
      post: () => apos.http.post(`${getAction()}/chat/${id}/retry`, {
        body: {
          retryOf: failedId,
          requestId,
          screen: getScreen()
        }
      }),
      check: () => findSent(id, requestId),
      refused: e => refuse(id, e)
    });
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
    delete confirmations.value[id];
    await act('revertCheck', id, {
      key: requestId,
      post: () => apos.http.post(`${getAction()}/chat/${id}/revert-check`, {
        body: {
          requestId,
          tabId: getTabId(),
          screen: getScreen()
        }
      }),
      // In the tick the dry run settles, so its busy state gives way to the
      // revert's line or its confirmation with no gap. A document still live
      // as published, by the assistant or with the changes it puts back, is
      // confirmed first
      taken(check) {
        const clean = check.documents
          .every(document => [ 'putBack', 'reverted' ].includes(document.outcome) &&
            !document.live && !document.published);
        if (clean) {
          runRevert(id, requestId, check.requestIds, cause);
        } else {
          confirmations.value[id] = {
            requestId,
            requestIds: check.requestIds,
            documents: check.documents,
            cause
          };
        }
      },
      refused: e => fail(id, e)
    });
  }

  // The revert the editor confirmed
  async function confirmRevert(id) {
    const confirmation = confirmations.value[id];
    if (!confirmation) {
      return;
    }
    const result = runRevert(id, confirmation.requestId, confirmation.requestIds,
      confirmation.cause);
    delete confirmations.value[id];
    await result;
  }

  function cancelRevert(id) {
    delete confirmations.value[id];
  }

  // Shows the revert running at once, the requests it takes out of view;
  // the server names it
  function runRevert(id, requestId, requestIds, cause) {
    return act('revert', id, {
      key: requestId,
      data: {
        chatId: id,
        revertId: createId(),
        requestIds,
        cause,
        before: (reverts.value[id] || []).map(revert => revert._id)
      },
      post: () => apos.http.post(`${getAction()}/chat/${id}/revert`, {
        body: {
          requestId,
          tabId: getTabId(),
          screen: getScreen(),
          ...(cause && { cause })
        }
      }),
      taken: ({ revert }) => returning.add(revert._id),
      refused: e => fail(id, e, { always: true })
    });
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
    await act('retryRevert', id, {
      key: revertId,
      post: () => apos.http.post(`${getAction()}/chat/${id}/revert-retry`, {
        body: {
          revertId,
          tabId: getTabId(),
          screen: getScreen()
        }
      }),
      taken() {
        if (rewinds) {
          returning.add(revertId);
        }
      },
      refused: e => fail(id, e)
    });
  }

  async function dismissRevert(id, revertId) {
    await act('dismissRevert', id, {
      key: revertId,
      post: () => apos.http.post(`${getAction()}/chat/${id}/revert-dismiss`, {
        body: { revertId }
      }),
      refused: e => fail(id, e)
    });
  }

  /**
   * Continues a chat in a new chat from one of its requests: the new chat's
   * tab opens at once, active, right of the chat's, carrying over what the
   * chat knew. Refused, the tab closes and the chat's tab says why.
   *
   * @param {string} id
   * @param {string} requestId
   */
  async function continueInNewChat(id, requestId) {
    const chatId = createId();
    const index = tabs.value.indexOf(id);
    tabs.value.splice((index === -1) ? 0 : index + 1, 0, chatId);
    activeId.value = chatId;
    rememberTabs();
    await carry(chatId, {
      chatId: id,
      requestId,
      title: getChat(id)?.title || null
    }, {
      refused(e) {
        if (tabs.value.includes(chatId)) {
          tabs.value.splice(tabs.value.indexOf(chatId), 1);
          if (activeId.value === chatId) {
            activeId.value = tabs.value.includes(id) ? id : (tabs.value[0] || NEW_CHAT);
          }
          if (!tabs.value.length) {
            tabs.value.push(NEW_CHAT);
          }
          rememberTabs();
        }
        fail(id, e, { always: true });
      }
    });
  }

  /**
   * Starts a continued chat's failed carry again.
   *
   * @param {string} id
   */
  async function retryCarry(id) {
    const { continuedFrom } = getChat(id) || {};
    if (continuedFrom) {
      await carry(id, continuedFrom, { refused: e => fail(id, e, { always: true }) });
    }
  }

  // The new chat exists from the click; its answer settles it, its thread
  // read once the carry ends
  function carry(chatId, continuedFrom, { refused }) {
    return act('continue', chatId, {
      data: {
        chatId,
        continuedFrom,
        createdAt: new Date().toISOString()
      },
      post: () => apos.http.post(`${getAction()}/chat/${continuedFrom.chatId}/continue`, {
        body: {
          requestId: continuedFrom.requestId,
          chatId
        }
      }),
      check: async () => {
        try {
          return { chat: (await apos.http.get(`${getAction()}/chat/${chatId}`, {})).chat };
        } catch (e) {
          return null;
        }
      },
      taken() {
        requests.value[chatId] = requests.value[chatId] || [];
        reverts.value[chatId] = reverts.value[chatId] || [];
      },
      refused
    });
  }

  /**
   * Dismisses the suggestion to continue in a new chat, in every browser
   * tab.
   *
   * @param {string} id
   * @param {string} suggestionId
   */
  async function dismissSuggestion(id, suggestionId) {
    await act('dismissSuggestion', id, {
      key: suggestionId,
      post: () => apos.http.post(`${getAction()}/chat/${id}/suggestion-dismiss`, {
        body: { suggestionId }
      }),
      refused: e => fail(id, e)
    });
  }

  /**
   * Cancels the plan of the chat's latest request: stops it if it is open
   * and waits for it to end, then reverts it as any revert, asking first
   * when it isn't clean.
   *
   * @param {string} id
   * @param {string} requestId
   */
  async function cancelPlan(id, requestId) {
    const open = () => getChatRecord(id)?.openRequest?._id === requestId;
    if (open() && !await stop(id, { planCancel: true })) {
      return;
    }
    await new Promise((resolve) => {
      if (!open()) {
        resolve();
        return;
      }
      const unwatch = watch(open, (still) => {
        if (!still) {
          unwatch();
          resolve();
        }
      });
    });
    if (getChatRecord(id)) {
      await startRevert(id, requestId, { cause: 'planCancel' });
    }
  }

  /**
   * An action the server didn't take: the view is the records again, read
   * anew. A chat deleted meanwhile is forgotten. One that got no answer
   * says so in the chat tab's dock, and so does a refused one with
   * `always`, whose click would otherwise vanish without a word.
   *
   * @param {string} id
   * @param {Error} e
   * @param {object} [options]
   * @param {boolean} [options.dock] `false` when what the editor acted on
   *   comes back in the dock's place (an ask, Continue here), or the editor
   *   acted elsewhere (All chats), which says it there.
   * @param {boolean} [options.always]
   */
  /**
   * Runs a notice's action, once, as a request of its own: its button goes
   * at the click and a request runs at the end of the thread. A refusal
   * says it was run already, in this browser tab or another: the records
   * are read again.
   *
   * @param {string} id
   * @param {object} request The request the notice is on.
   * @param {object} notice
   */
  async function runNoticeAction(id, request, notice) {
    await act('noticeAction', id, {
      key: notice._id,
      data: {
        requestId: request._id,
        noticeId: notice._id,
        name: notice.action.name
      },
      post: () => apos.http.post(`${getAction()}/chat/${id}/notice-action`, {
        body: {
          requestId: request._id,
          noticeId: notice._id,
          screen: getScreen()
        }
      }),
      // Run once: its button is gone, as the source's event says to every
      // browser tab
      taken() {
        const source = requests.value[id]?.find(each => each._id === request._id);
        if (source) {
          setRequest(markNoticeAction(source, notice._id, () => null));
        }
      },
      refused: e => fail(id, e)
    });
  }

  // A request with one notice's action changed
  function markNoticeAction(request, noticeId, change) {
    return {
      ...request,
      notices: (request.notices || []).map(notice => ((notice._id === noticeId)
        ? {
          ...notice,
          action: change(notice.action)
        }
        : notice))
    };
  }

  function fail(id, e, { dock = true, always = false } = {}) {
    if (e.status === 404) {
      if (dock && (activeId.value === id)) {
        deleted(id);
      } else {
        forget(id);
      }
      return;
    }
    if (e.status && ![ 400, 409 ].includes(e.status)) {
      report(e);
    }
    if (dock && (!e.status || always)) {
      refusals.value[id] = {
        title: 'apostrophe:assistantNotDone',
        text: e.status
          ? 'apostrophe:assistantNotDoneRefused'
          : 'apostrophe:assistantNotDoneNoAnswer'
      };
    }
  }

  // Deleted in another browser tab: the draft moves to a new chat
  function deleted(id) {
    const draft = drafts.value[id];
    forget(id);
    newChat();
    drafts.value[NEW_CHAT] = draft;
    refusals.value[NEW_CHAT] = {
      title: 'apostrophe:assistantChatDeleted'
    };
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
      deleted(id);
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

  // A message back in the composer, in front of anything typed since
  function prependDraft(id, message) {
    const draft = drafts.value[id] || '';
    setDraft(id, draft.trim() ? `${message}\n\n${draft}` : message);
  }

  /**
   * Asks a composer for a prompt: it translates `key` with `count` and puts
   * it in front of the draft, the caret where the translation has
   * `{{ caret }}`. The active chat tab's, when it could send at once;
   * otherwise the new chat tab's, which becomes active, so a running chat
   * never holds the prompt.
   *
   * @param {string} key
   * @param {number} count
   */
  function askPrompt(key, count) {
    const chat = getChat(activeId.value);
    const busy = (getOwner(chat) !== 'none') || chat?.openRevert || chat?.carry ||
      confirmations.value[activeId.value];
    if (busy) {
      newChat();
    }
    askedPrompt.value = {
      chatId: activeId.value,
      key,
      count
    };
  }

  // The editor opened the panel or a chat tab: the composer takes focus,
  // once it is there
  function focusComposer() {
    composerFocus.value = true;
  }

  function takeComposerFocus() {
    const asked = composerFocus.value;
    composerFocus.value = false;
    return asked;
  }

  // The prompt asked for a chat tab, taken once by its composer
  function takeAskedPrompt(id) {
    if (askedPrompt.value?.chatId !== id) {
      return null;
    }
    const asked = askedPrompt.value;
    askedPrompt.value = null;
    return asked;
  }

  // A prompt in front of a chat tab's draft; the same prompt twice in a row
  // is put there once
  function prefill(id, prompt) {
    if (!(drafts.value[id] || '').startsWith(prompt)) {
      prependDraft(id, prompt);
    }
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
    tabTitles.value = (stored.titles && (typeof stored.titles === 'object'))
      ? stored.titles
      : {};
    newChatId = (typeof stored.newChatId === 'string') ? stored.newChatId : null;
  }

  // The chat tabs, and their titles as shown now
  function rememberTabs() {
    const titles = {};
    for (const id of tabs.value) {
      const title = getTabTitle(id);
      if (title) {
        titles[id] = title;
      }
    }
    tabTitles.value = titles;
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
        tabs: tabs.value,
        activeId: activeId.value,
        titles,
        newChatId
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
    chatsFailed,
    requests,
    tabs,
    activeId,
    drafts,
    refusals,
    sendWaiting,
    attached: attachments.attached,
    attachRefusals: attachments.attachRefusals,
    previews: attachments.previews,
    progress,
    reverts,
    revertProgress,
    confirmations,
    browserSteps,
    getChat,
    getChats,
    getRequests,
    getReverts,
    isPending,
    getThreadState,
    getTabTitle,
    takeRefusedAnswer,
    getOwner,
    getBrowserStep,
    start,
    resume,
    catchUp,
    loadChat,
    loadStep,
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
    continueInNewChat,
    retryCarry,
    dismissSuggestion,
    findMentions,
    setDraft,
    askPrompt,
    askedPrompt,
    composerFocus,
    focusComposer,
    takeComposerFocus,
    takeAskedPrompt,
    prefill,
    runNoticeAction,
    canAttach,
    canUpload: attachments.canUpload,
    getAttached: attachments.getAttached,
    isUploading: attachments.isUploading,
    isFull: attachments.isFull,
    attachFiles: attachments.attachFiles,
    removeAttached: attachments.removeAttached,
    dismissAttachRefusal: attachments.dismissAttachRefusal
  };
});
