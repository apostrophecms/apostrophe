import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { createId } from '@paralleldrive/cuid2';

export const useNotificationStore = defineStore('notification', () => {
  const backendNotifs = ref([]);
  const clientNotifs = ref([]);
  const dismissed = ref([]);
  const processes = ref({});

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
        const allNotifications = [ ...backendNotifs.value, ...dismissed.value ];
        const latestTimestamp = allNotifications
          .map(({ updatedAt }) => updatedAt)
          .sort()
          .at(-1);

        const seenIds = allNotifications
          .filter((notification) => notification.updatedAt === latestTimestamp)
          .map((notification) => notification._id);

        const res = await apos.http.get(apos.notification.action, {
          ...(latestTimestamp && {
            qs: {
              modifiedOnOrSince: latestTimestamp,
              seenIds // TODO: can be skipped if we replace $gte to $gt backend side
            }
          })
        });

        backendNotifs.value = [
          ...backendNotifs.value,
          ...(res.notifications || [])
        ];
        dismissed.value = [ ...dismissed.value, ...(res.dismissed || []) ];
        if (res.dismissed.length) {
          backendNotifs.value = backendNotifs.value.filter((notif) => {
            return !res.dismissed.some((element) => notif._id === element._id);
          });
        }
        // Long polling, we should reconnect promptly, the server
        // is responsible for keeping that request open for a reasonable
        // amount of time if there are no new messages, not us
        setTimeout(poll, 50);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      setTimeout(poll, 5000);
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
