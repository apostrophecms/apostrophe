import { defineStore } from 'pinia';
import { ref } from 'vue';
import { createId } from '@paralleldrive/cuid2';

export const useNotificationStore = defineStore('notification', () => {
  const notifications = ref([]);
  const dismissed = ref([]);
  const processes = ref({});

  /**
   * @param {string} message - Notification message
   * @param {object} options.interpolate - Translation interpolate object
   * @param {string} options.type - Notification type
   * @param {string} options.icon - Notification icon
   * @param {boolean|number} options.dismiss - Notification dismiss behavior
   * @param {array} options.buttons - Notification buttons
   * @param {boolean} options.localize - Should the message be localized
   * @param {object} options.progress - Instantiate progress state
   * @returns null|string When clientOnly is passed we return the ID of the notification
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
      localize: options.localize,
      progress: options.progress
    };

    // Send it to the server, which will send it back to us via polling
    if (!options.clientOnly) {
      await apos.http.post(apos.notification.action, { body: notif });
      return;
    }

    const _id = createId();
    const clientNotif = {
      _id,
      progress: options.progress || {},
      updatedAt: new Date(),
      ...notif
    };

    notifications.value = [
      clientNotif,
      ...notifications.value
    ];

    return _id;
  }

  async function dismiss(notifId) {
    await apos.http.patch(`${apos.notification.action}/${notifId}`, {
      body: {
        dismissed: true
      }
    });
    notifications.value = notifications.value.filter(
      ({ _id }) => notifId !== _id
    );
  }

  /**
   * @param {string} notifId - Notification ID
   * @param {object} data - Notification Data to update
   */
  function updateClientNotif(notifId, data) {
    notifications.value = notifications.value.map((notif) => {
      if (notif._id === notifId) {
        return {
          ...notif,
          ...data,
          updatedAt: new Date()
        };
      }
      return notif;
    });
  }

  async function poll() {
    try {
      if (document.visibilityState === 'hidden') {
        // Wait for tab to become visible
        setTimeout(poll, 5000);
      } else {
        const allNotifications = [ ...notifications.value, ...dismissed.value ];
        const latestTimestamp = allNotifications
          .map((notification) => {
            return notification.updatedAt;
          })
          .sort()
          .reverse()[0];

        const seenIds = allNotifications
          .filter((notification) => notification.updatedAt === latestTimestamp)
          .map((notification) => notification._id);

        const res = await apos.http.get(apos.notification.action, {
          ...(latestTimestamp && {
            qs: {
              modifiedOnOrSince: latestTimestamp,
              seenIds // Useless, should change $gte to $gt backend side
            }
          })
        });

        notifications.value = [
          ...notifications.value,
          ...(res.notifications || [])
        ];
        dismissed.value = [ ...dismissed.value, ...(res.dismissed || []) ];
        if (res.dismissed.length) {
          notifications.value = notifications.value.filter((notif) => {
            return !res.dismissed.some((element) => notif._id === element._id);
          });
        }
        // Long polling, we should reconnect promptly, the server
        // is responsible for keeping that request open for a reasonable
        // amount of time if there are no new messages, not us
        setTimeout(poll, 50);
      }
    } catch (err) {
      console.error(err);
      setTimeout(poll, 5000);
    }
  }

  function startProcess(_id = null) {
    const id = _id || createId();
    processes.value[id] = {
      processed: 0,
      percent: 0,
      total: 1
    };
    return id;
  }

  function dimissProcess(id) {
    delete processes.value[id];
  }

  function updateProcess(id, processed, _total = null) {
    let process = processes.value[id];
    if (!process) {
      return;
    }

    const total = _total || process.total;
    process = {
      processed,
      total: process.total,
      percent: (processed / total * 100).toFixed(2)
    };
  }

  // TODO: Responsible to update create and update associated process
  async function pollJob(notifId, jobRoute) {
    const process = processes.value[notifId];
    if (!process) {
      return;
    }

    // TODO: Needed? Not sure
    /* if (!this.job?.progress.total) { */
    /*   return; */
    /* } */

    const job = await apos.http.get(jobRoute, {});
    // TODO: Removed backend computation
    /* this.job.progress.percentage = job.percentage; */
    updateProcess(notifId, job.processed, job.total);

    if (job.processed < job.total && !job.ended) {
      setTimeout(() => pollJob(notifId, jobRoute), 500);
      return;
    }

    if (this.job.ids) {
      apos.bus.$emit('content-changed', {
        docIds: this.job.ids,
        action: this.job.action || 'batch-update'
      });
    }
  }

  // `clearEvent` returns true if the event was found and cleared. Otherwise
  // returns `false`
  async function clearEvent(id) {
    return await apos.http.post(`${apos.notification.action}/${id}/clear-event`, {
      body: {}
    });
  }

  return {
    notifications,
    startProcess,
    notify,
    updateClientNotif,
    poll,
    pollJob,
    dismiss,
    clearEvent
  };
});
