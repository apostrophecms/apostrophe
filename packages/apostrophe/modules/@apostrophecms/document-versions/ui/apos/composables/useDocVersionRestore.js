import { klona } from 'klona';
import { useModalStore } from 'Modules/@apostrophecms/ui/stores/modal';

/**
 * Restores a version over the live draft of the document open in the
 * versions modal. The save names the version, so its record is a restore.
 * `restore(item)` resolves with the updated document, or
 * `null` when nothing was restored and the user has been told why: the
 * version could not be loaded, the save was refused, or the lock was lost.
 *
 * @param {object} options
 * @param {import('vue').Ref<string>} options.docAction
 *   The document's REST URL
 * @param {object} options.originalDoc
 *   The document as it was when the modal opened
 * @param {(versionId: string) => Promise<object>} options.fetchVersion
 *   Loads a version as stored. The document the modal shows is marked
 *   with its changes and is never the one restored
 * @param {object} options.lock
 *   The modal's advisory lock: `addLockToRequest`, `isLockedError` and
 *   `showLockedError`
 * @param {(updated: object) => void} options.onRestored
 *   Called after a restore that does not leave the page
 */
export function useDocVersionRestore({
  docAction,
  originalDoc,
  fetchVersion,
  lock,
  onRestored
}) {
  const modalStore = useModalStore();

  async function restore(item) {
    const doc = await getDoc(item);
    if (!doc) {
      await notifyError();
      return null;
    }
    try {
      const body = {
        ...klona(doc),
        _restoreVersion: item._id
      };
      lock.addLockToRequest(body);
      const updated = await apos.http.put(docAction.value, {
        body,
        busy: true,
        draft: true
      });
      apos.notify('apostrophe:versionRestored', {
        type: 'success',
        icon: 'archive-arrow-up-icon',
        dismiss: true
      });
      if (refreshRedirect(updated)) {
        return updated;
      }
      apos.bus.$emit('content-changed', {
        doc: updated,
        action: 'restoreVersion'
      });
      onRestored(updated);
      return updated;
    } catch (e) {
      if (lock.isLockedError(e)) {
        await lock.showLockedError(e);
        return null;
      }
      await notifyError();
      return null;
    }
  }

  async function getDoc(item) {
    if (item.doc) {
      return item.doc;
    }
    try {
      return (await fetchVersion(item._id)).doc;
    } catch (e) {
      return null;
    }
  }

  // In-context editing: a restored slug moves the page under our feet
  function refreshRedirect(updated) {
    const isInContextEdit = modalStore.stack.length === 1;
    if (isInContextEdit && originalDoc.slug !== updated.slug) {
      const current = new URL(window.location.href);
      if (!updated._url.match(current.pathname)) {
        window.location = updated._url;
        return true;
      }
    }
    return false;
  }

  function notifyError() {
    return apos.notify('apostrophe:versionFailVersionRestoreMessage', {
      type: 'danger',
      icon: 'alert-circle-icon',
      dismiss: true
    });
  }

  return { restore };
}
