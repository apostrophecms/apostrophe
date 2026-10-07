import { onUnmounted, ref } from 'vue';

const REFRESH_INTERVAL = 10000;

/**
 * Advisory lock on a document, the composition counterpart of
 * `AposAdvisoryLockMixin`. Obtains the lock with `lock(url)`, refreshes
 * it while held and releases it on `unlock()` or when the component
 * unmounts. A refresh that finds the lock taken by someone else shows
 * the standard alert and calls `onLockLost`.
 *
 * @param {{ onLockLost?: () => void }} [options]
 * @returns {{
 *   locked: import('vue').Ref<boolean>,
 *   lock: (url: string) => Promise<boolean>,
 *   unlock: () => Promise<void>,
 *   addLockToRequest: (body: object) => void,
 *   isLockedError: (e: any) => boolean,
 *   showLockedError: (e: any) => Promise<void>
 * }}
 */
export function useAdvisoryLock({ onLockLost } = {}) {
  const locked = ref(false);
  let lockApiUrl = null;
  let refreshTimeout = null;
  let refreshing = null;

  function lockBody(extra = {}) {
    return {
      _advisoryLock: {
        tabId: apos.adminBar.tabId,
        lock: true,
        ...extra
      }
    };
  }

  function isLockedError(e) {
    return e?.body?.name === 'locked';
  }

  async function showLockedError(e) {
    await apos.alert({
      heading: 'apostrophe:multipleEditors',
      description: e.body.data.me
        ? 'apostrophe:youTookControl'
        : 'apostrophe:someoneElseTookControl',
      interpolate: {
        who: e.body.data.title
      }
    });
  }

  function addLockToRequest(body) {
    body._advisoryLock = {
      tabId: apos.adminBar.tabId,
      lock: true
    };
  }

  // Resolves `true` when the lock is held, `false` when someone else holds
  // it and the user declined to take it over. Any other request error is
  // thrown for the caller to handle.
  async function lock(url) {
    lockApiUrl = url;
    try {
      await apos.http.patch(url, {
        body: lockBody(),
        draft: true,
        busy: true
      });
      markLocked();
      return true;
    } catch (e) {
      if (!isLockedError(e)) {
        throw e;
      }
      const takeControl = await apos.confirm({
        heading: e.body.data.me
          ? 'apostrophe:docInUseBySelf'
          : 'apostrophe:docInUseByAnother',
        description: e.body.data.me
          ? 'apostrophe:takeControlFromSelf'
          : 'apostrophe:takeControlFromOther'
      }, {
        interpolate: {
          who: e.body.data.title
        }
      });
      if (!takeControl) {
        return false;
      }
      try {
        await apos.http.patch(url, {
          body: lockBody({ force: true }),
          draft: true,
          busy: true
        });
        markLocked();
        return true;
      } catch (forceError) {
        await apos.notify(forceError.message, {
          type: 'danger',
          localize: false
        });
        return false;
      }
    }
  }

  async function unlock() {
    if (!locked.value) {
      return;
    }
    // Stop refreshing first so a refresh in flight cannot reschedule
    locked.value = false;
    clearTimeout(refreshTimeout);
    refreshTimeout = null;
    if (refreshing) {
      await refreshing;
    }
    try {
      await apos.http.patch(lockApiUrl, {
        body: {
          _advisoryLock: {
            tabId: apos.adminBar.tabId,
            lock: false
          }
        },
        draft: true,
        busy: true
      });
    } catch (e) {
      // Releasing is a courtesy; the lock expires on its own
    }
  }

  function markLocked() {
    locked.value = true;
    scheduleRefresh();
  }

  function scheduleRefresh() {
    clearTimeout(refreshTimeout);
    refreshTimeout = setTimeout(refreshLock, REFRESH_INTERVAL);
  }

  function refreshLock() {
    refreshing = (async () => {
      try {
        await apos.http.patch(lockApiUrl, {
          body: lockBody(),
          draft: true
        });
        if (locked.value) {
          scheduleRefresh();
        }
      } catch (e) {
        if (!locked.value) {
          return;
        }
        if (isLockedError(e)) {
          locked.value = false;
          clearTimeout(refreshTimeout);
          refreshTimeout = null;
          await showLockedError(e);
          onLockLost?.();
          return;
        }
        // A transient failure; keep the lock alive
        scheduleRefresh();
      } finally {
        refreshing = null;
      }
    })();
  }

  onUnmounted(unlock);

  return {
    locked,
    lock,
    unlock,
    addLockToRequest,
    isLockedError,
    showLockedError
  };
}
