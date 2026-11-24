import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { createId } from 'apostrophe/lib/beneath.js';
import { getTabId } from 'Modules/@apostrophecms/ui/utils';

export const useNotificationStore = defineStore('notification', () => {
  const backendNotifs = ref([]);
  const clientNotifs = ref([]);
  const processes = ref({});
  // The poll's position: the newest `updatedAt` received, and what was
  // received within the lookback below it, each id with its `updatedAt`.
  // The server reads that far back, since a write can become visible
  // late, and leaves these out. Every record moves it, bus carriers
  // included
  const cursor = {
    at: null,
    seen: new Map()
  };
  // With more held records than this the poll travels as a POST. A
  // safety measure for bursts: a query string that long may be refused,
  // and the same poll would then be retried without end
  const maxSeenInQuery = 30;

  const notifications = computed(() => {
    return [ ...clientNotifs.value, ...backendNotifs.value ]
      .sort((a, b) => a.updatedAt > b.updatedAt ? 1 : -1);
  });

  /**
   * @param {string} message - Notification message
   * @param {object} options.interpolate - Translation interpolate object
   * @param {string} options.type - Notification type
   * @param {string} options.icon - Notification icon
   * @param {boolean|number} options.dismiss - Notification dismiss behavior
   * @param {array} options.buttons - Notification buttons
   * @param {boolean} options.localize - Should the message be localized
   * @returns string - Returns ID of the created notification
   */
  async function notify(message, options = {}) {
    if (options.dismiss === true) {
      options.dismiss = 5;
    }

    const notif = {
      message,
      interpolate: options.interpolate || {},
      type: options.type,
      icon: options.icon,
      dismiss: options.dismiss,
      buttons: options.buttons,
      localize: options.localize
    };

    if (!options.clientOnly) {
      // Send it to the server, which will send it back to us via polling
      const { noteId } = await apos.http.post(apos.notification.action, { body: notif });
      return noteId;
    }

    const clientNotif = {
      _id: createId(),
      updatedAt: new Date(),
      ...notif
    };
    clientNotifs.value = [
      ...clientNotifs.value,
      clientNotif
    ];

    return clientNotif._id;
  }

  /**
   * @param {string} notifId - Notification ID
   */
  async function dismiss(notifId) {
    await apos.http.patch(`${apos.notification.action}/${notifId}`, {
      body: {
        dismissed: true
      }
    });
    backendNotifs.value = backendNotifs.value.filter(
      ({ _id }) => notifId !== _id
    );
    clientNotifs.value = clientNotifs.value.filter(
      ({ _id }) => notifId !== _id
    );
    if (processes.value[notifId]) {
      delete processes.value[notifId];
    }
  }

  async function poll() {
    try {
      if (document.visibilityState === 'hidden') {
        // Wait for tab to become visible
        setTimeout(poll, 5000);
      } else {
        const held = [ ...cursor.seen ];
        const qs = {
          tabId: getTabId(),
          pageStart: apos.notification.pageStart,
          ...(cursor.at && {
            modifiedOnOrSince: cursor.at,
            // For a server from before `seen`, while a deployment rolls out
            seenIds: held.filter(([ , at ]) => at === cursor.at).map(([ id ]) => id),
            seen: Object.fromEntries(held.map(([ id, at ]) => [ id, Date.parse(at) ]))
          })
        };
        const res = held.length > maxSeenInQuery
          ? await apos.http.post(apos.notification.action, {
            body: { __aposGetWithQuery: qs }
          })
          : await apos.http.get(apos.notification.action, { qs });

        const incoming = res.notifications || [];
        advance([ ...incoming, ...(res.dismissed || []) ]);
        // Bus notifications are pure event carriers: emit their events
        // and keep them out of the visible list
        await emitBusEvents(incoming.filter((notif) => notif.bus));
        backendNotifs.value = [
          ...backendNotifs.value,
          ...incoming.filter((notif) => !notif.bus)
        ];
        if (res.dismissed.length) {
          backendNotifs.value = backendNotifs.value.filter((notif) => {
            return !res.dismissed.some((element) => notif._id === element._id);
          });
        }
        // If using long polling we should reconnect promptly, the server
        // is responsible for keeping that request open for a reasonable
        // amount of time if there are no new messages, not us
        const timeout = apos.notification.longPolling
          ? 50
          : apos.notification.pollingInterval;
        setTimeout(poll, timeout);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      setTimeout(poll, 5000);
    }

    // Move the cursor to the newest record received and keep only what
    // is still within the lookback below it. `updatedAt` arrives as an
    // ISO string, which sorts as the time it stands for
    function advance(records) {
      for (const { _id, updatedAt } of records) {
        cursor.seen.set(_id, updatedAt);
        if (!cursor.at || updatedAt > cursor.at) {
          cursor.at = updatedAt;
        }
      }
      if (!cursor.at) {
        return;
      }
      const floor = new Date(
        Date.parse(cursor.at) - apos.notification.lookback
      ).toISOString();
      for (const [ id, at ] of cursor.seen) {
        if (at < floor) {
          cursor.seen.delete(id);
        }
      }
    }

    // Emit each bus notification's event, oldest first. A carrier with
    // a `tab` (every tab, or this one) is emitted as it comes: nobody
    // claims or dismisses it, it expires. Any other is emitted by the one
    // browser tab that wins clearEvent, then dismissed; an
    // already-cleared event is dismissed without emitting
    async function emitBusEvents(notifs) {
      notifs.sort((a, b) => a.updatedAt > b.updatedAt ? 1 : -1);
      for (const notif of notifs) {
        if (notif.tab) {
          apos.bus.$emit(notif.event.name, notif.event.data);
          continue;
        }
        if (notif.event?.name && await clearEvent(notif._id)) {
          apos.bus.$emit(notif.event.name, notif.event.data);
        }
        await dismiss(notif._id);
      }
    }
  }

  /**
   * @param {number} id - Notification ID
   */
  function startProcess(id) {
    processes.value[id] = {
      processed: 0,
      percent: 0,
      total: 1
    };
  }

  /**
   * @param {string} id - Notification ID
   * @param {number} processed - Processed items by process
   * @param {number|null} _total - Total to items to process
   */
  function updateProcess(id, processed, _total = null) {
    if (!processes.value[id]) {
      return;
    }

    const total = _total || processes[id].value.total;
    processes.value = {
      ...processes.value,
      [id]: {
        processed,
        total,
        percent: (processed / total * 100).toFixed(2)
      }
    };
  }

  /**
   * @param {string} notifId - Notification ID
   * @param {string} jobInfo.route - Job route to get updates
   * @param {string} jobInfo.action - Job action
   * @param {string} jobInfo.moduleName - Module name the job has been created from
   * @param {array} jobInfo.ids - Job IDS
   */
  async function pollJob(notifId, jobInfo) {

    try {
      const job = await apos.http.get(jobInfo.value.route, {});
      updateProcess(notifId, job.processed, job.total);

      if (job.processed < job.total && !job.ended) {
        setTimeout(() => pollJob(notifId, jobInfo), 500);
        return;
      }

      apos.bus.$emit('content-changed', {
        docIds: jobInfo.value.ids || [],
        action: jobInfo.value.action || 'batch-update',
        docTypes: jobInfo.value.docTypes
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      dismiss(notifId);
    }
  }

  /**
   * @param {string} id - Notification ID
   */
  async function clearEvent(id) {
    return await apos.http.post(`${apos.notification.action}/${id}/clear-event`, {
      body: {}
    });
  }

  return {
    notifications,
    processes,
    startProcess,
    updateProcess,
    notify,
    poll,
    pollJob,
    dismiss,
    clearEvent
  };
});
