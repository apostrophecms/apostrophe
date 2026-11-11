import { defineStore } from 'pinia';
import { ref } from 'vue';
import { getTabId } from 'Modules/@apostrophecms/ui/utils';
import { useScreen } from 'Modules/@apostrophecms/ui/composables/useScreen.js';

/**
 * The assistant's chats as this browser tab sees them. The records on the
 * server are the truth: everything here is read from the routes, and the
 * `assistant-chat` bus event only says what to read again. A missed event
 * costs speed, never truth: coming back to the browser tab reads it all.
 *
 * The chat tabs are this browser tab's own, kept in session storage. A new
 * chat is created on the server by its first send, so `NEW_CHAT` stands for
 * the chat tab of a chat that has no record yet.
 */

export const NEW_CHAT = 'new';

const STORAGE_KEY = 'aposAssistantTabs';
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

  let started = false;
  let chatsSequence = 0;
  const chatSequences = new Map();
  const pending = new Set();
  let timer = null;

  function getAction() {
    return apos.modules['@apostrophecms/assistant'].action;
  }

  function getChat(id) {
    return chats.value.find(chat => chat._id === id) || null;
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
    }
    await catchUp();
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
    const visible = document.visibilityState === 'visible';
    if (chats.value.some(chat => getOwner(chat) === 'here')) {
      try {
        await apos.http.post(`${getAction()}/visibility`, {
          body: {
            tabId: getTabId(),
            visible
          }
        });
      } catch (e) {
        // The next message reports the screen again
      }
    }
    if (visible) {
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
    if ((stage === 'chat') || (stage === 'request')) {
      if (stage === 'request') {
        delete progress.value[requestId];
      }
      schedule('chats');
      if (requests.value[chatId] || tabs.value.includes(chatId)) {
        schedule(chatId);
      }
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
   * Stops the chat's running request. Any browser tab may stop it; a stop
   * the server refuses means the view was stale, and reading the records
   * again shows what is true now.
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
    getChat,
    getOwner,
    start,
    catchUp,
    openChat,
    newChat,
    activate,
    closeTab,
    rename,
    remove,
    send,
    stop,
    retry,
    setDraft
  };
});
