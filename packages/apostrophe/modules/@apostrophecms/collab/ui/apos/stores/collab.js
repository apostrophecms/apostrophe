// Who else is editing the document on this page, and what they last did.
//
// The collaboration session itself (see `lib/session.js`) belongs to the
// context bar, which starts and stops it and hands it to us, so that editors
// anywhere on the page can find it with `session`.

import { defineStore } from 'pinia';
import { ref, markRaw } from 'vue';

// How long someone's latest action stays pointed out, fully visible and then
// fading away, in milliseconds. Kept in step with the CSS in
// `TheAposCollabPresence.vue`
export const markerHold = 3000;
export const markerFade = 2000;

// A color for each person, the same on every screen
export function colorFor(userId) {
  let hash = 0;
  for (const char of String(userId || '')) {
    hash = ((hash * 31) + char.charCodeAt(0)) | 0;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 70%, 42%)`;
}

export function initialsFor(title) {
  const words = String(title || '?').trim().split(/\s+/).filter(Boolean);
  return words.slice(0, 2).map(word => word[0].toUpperCase()).join('') || '?';
}

export const useCollabStore = defineStore('collab', () => {
  const session = ref(null);
  // Tab ids to `{ tabId, userId, title, color, initials, awareness,
  // lastAction }`
  const collaborators = ref({});

  function setSession(value) {
    session.value = value ? markRaw(value) : null;
    collaborators.value = {};
  }

  function describe({
    tabId, userId, title
  }) {
    return {
      tabId,
      userId,
      title: title || '',
      color: colorFor(userId),
      initials: initialsFor(title),
      awareness: collaborators.value[tabId]?.awareness || null,
      lastAction: collaborators.value[tabId]?.lastAction || null
    };
  }

  // Everyone the server says is here, other than us
  function setPresence(list) {
    const next = {};
    for (const entry of list) {
      if (entry.tabId !== session.value?.tabId) {
        next[entry.tabId] = describe(entry);
      }
    }
    collaborators.value = next;
  }

  function onPresence(data) {
    if (data.tabId === session.value?.tabId) {
      return;
    }
    if (data.left) {
      const next = { ...collaborators.value };
      delete next[data.tabId];
      collaborators.value = next;
      return;
    }
    collaborators.value = {
      ...collaborators.value,
      [data.tabId]: describe(data)
    };
  }

  // Someone we did not know was here just did something
  function ensure(data) {
    if (!data.tabId || (data.tabId === session.value?.tabId)) {
      return null;
    }
    if (!collaborators.value[data.tabId]) {
      collaborators.value = {
        ...collaborators.value,
        [data.tabId]: describe(data)
      };
    }
    return collaborators.value[data.tabId];
  }

  function onAwareness(data) {
    const collaborator = ensure(data);
    if (!collaborator) {
      return;
    }
    collaborators.value = {
      ...collaborators.value,
      [data.tabId]: {
        ...collaborator,
        awareness: {
          key: data.key || null,
          anchor: data.anchor,
          head: data.head,
          widgetId: data.widgetId || null
        }
      }
    };
  }

  // Remember what someone last did: `{ widgetId, anchorId, patchKey }`
  function recordAction(data, target) {
    const collaborator = ensure(data);
    if (!collaborator) {
      return null;
    }
    const lastAction = {
      ...target,
      at: Date.now()
    };
    collaborators.value = {
      ...collaborators.value,
      [data.tabId]: {
        ...collaborator,
        lastAction
      }
    };
    return collaborators.value[data.tabId];
  }

  return {
    session,
    collaborators,
    setSession,
    setPresence,
    onPresence,
    onAwareness,
    recordAction
  };
});
