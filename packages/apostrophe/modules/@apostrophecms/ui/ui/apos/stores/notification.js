import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { createId } from 'apostrophe/lib/beneath.js';

export const useNotificationStore = defineStore('notification', () => {
  const backendNotifs = ref([]);
  const clientNotifs = ref([]);
  const dismissed = ref([]);
  const processes = ref({});
  // Channel subscriptions: the last `seq` received on each channel, or null
  // until the server tells us where the channel stands, and how many
  // subscribers asked for each
  const channelCursors = {};
  const channelRefs = {};
  // Channels to the resolve functions of `subscribeChannel` calls waiting
  // for messages to start flowing
  const channelWaiters = {};
  // Only the latest call to `poll` may carry on: `restartPoll` retires the
  // others by bumping the generation
  let pollGeneration = 0;
  let pollTimer = null;
  let pollController = null;
  let polling = false;

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
    polling = true;
    const generation = ++pollGeneration;
    clearTimeout(pollTimer);
    try {
      if (document.visibilityState === 'hidden') {
        // Wait for tab to become visible
        schedulePoll(5000);
      } else {
        const allNotifications = [ ...backendNotifs.value, ...dismissed.value ];
        const latestTimestamp = allNotifications
          .map(({ updatedAt }) => updatedAt)
          .sort()
          .at(-1);
        const subscribed = Object.keys(channelCursors).length > 0;

        pollController = new AbortController();
        const res = await apos.http.get(apos.notification.action, {
          qs: {
            ...(latestTimestamp && {
              modifiedOnOrSince: latestTimestamp
            }),
            ...(subscribed && {
              channels: JSON.stringify(channelCursors),
              tabId: apos.adminBar?.tabId
            })
          },
          signal: pollController.signal
        });
        if (generation !== pollGeneration) {
          return;
        }

        const incoming = res.notifications || [];
        // Bus notifications are pure event carriers: emit their events
        // and keep them out of the visible list
        await emitBusEvents(incoming.filter((notif) => notif.bus));
        backendNotifs.value = [
          ...backendNotifs.value,
          ...incoming.filter((notif) => !notif.bus)
        ];
        dismissed.value = [ ...dismissed.value, ...(res.dismissed || []) ];
        if (res.dismissed.length) {
          backendNotifs.value = backendNotifs.value.filter((notif) => {
            return !res.dismissed.some((element) => notif._id === element._id);
          });
        }
        receiveChannelMessages(res);
        if (generation !== pollGeneration) {
          // Restarted while we were emitting events: a newer poll carries on
          return;
        }
        // If using long polling we should reconnect promptly, the server
        // is responsible for keeping that request open for a reasonable
        // amount of time if there are no new messages, not us
        const timeout = apos.notification.longPolling
          ? 50
          : apos.notification.pollingInterval;
        schedulePoll(timeout);
      }
    } catch (err) {
      if (generation !== pollGeneration) {
        // Aborted by restartPoll, which has already started the next poll
        return;
      }
      // eslint-disable-next-line no-console
      console.error(err);
      schedulePoll(5000);
    }

    // Emit each bus notification's event, oldest first — clearEvent
    // makes exactly one tab the emitter — then dismiss the carrier.
    // An already-cleared event is dismissed without emitting
    async function emitBusEvents(notifs) {
      notifs.sort((a, b) => a.updatedAt > b.updatedAt ? 1 : -1);
      for (const notif of notifs) {
        if (notif.event?.name && await clearEvent(notif._id)) {
          apos.bus.$emit(notif.event.name, notif.event.data);
        }
        await dismiss(notif._id);
      }
    }
  }

  function schedulePoll(ms) {
    clearTimeout(pollTimer);
    pollTimer = setTimeout(poll, ms);
  }

  // Abandon the pending poll, if any, and poll again now. Does nothing
  // until polling has been started
  function restartPoll() {
    if (!polling) {
      return;
    }
    const controller = pollController;
    // Retire the pending poll before aborting it, so its failure is ignored
    pollGeneration++;
    controller?.abort();
    poll();
  }

  // Channel messages arrive in `seq` order per channel. Each message's
  // event is emitted on `apos.bus` with its data, plus a second argument
  // `{ channel, seq, senderId }`. A message this tab sent carries no event.
  //
  // If messages were missed (this tab fell further behind than the server
  // keeps messages), `notification-channel-gap` is emitted with
  // `{ channel, after, next }` so the subscriber can resynchronize. If the
  // user may not subscribe, `notification-channel-refused` is emitted with
  // `{ channel }` and the subscription is dropped.
  function receiveChannelMessages(res) {
    for (const channel of res.refusedChannels || []) {
      delete channelCursors[channel];
      delete channelRefs[channel];
      (channelWaiters[channel] || []).forEach(resolve => resolve());
      delete channelWaiters[channel];
      apos.bus.$emit('notification-channel-refused', { channel });
    }
    for (const [ channel, seq ] of Object.entries(res.channelCursors || {})) {
      if (channelCursors[channel] === null) {
        channelCursors[channel] = seq;
      }
    }
    for (const [ channel, waiters ] of Object.entries(channelWaiters)) {
      if (channelCursors[channel] !== null) {
        delete channelWaiters[channel];
        waiters.forEach(resolve => resolve());
      }
    }
    for (const {
      channel, seq, event, senderId
    } of res.channelMessages || []) {
      const cursor = channelCursors[channel];
      if ((cursor == null) || (seq <= cursor)) {
        // Unsubscribed meanwhile, or already seen
        continue;
      }
      if (seq > cursor + 1) {
        apos.bus.$emit('notification-channel-gap', {
          channel,
          after: cursor,
          next: seq
        });
      }
      channelCursors[channel] = seq;
      if (event?.name) {
        apos.bus.$emit(event.name, event.data, {
          channel,
          seq,
          senderId
        });
      }
    }
  }

  // Start receiving the messages triggered on `channel` from now on (see
  // `apos.notify` on the server). Calls are counted: the subscription lasts
  // until `unsubscribeChannel` has been called as many times.
  //
  // Resolves once the server has taken the subscription, so that nothing
  // triggered after that is missed. Also resolves, at once, if nothing is
  // polling, e.g. because no one is logged in
  function subscribeChannel(channel) {
    channelRefs[channel] = (channelRefs[channel] || 0) + 1;
    if (channelRefs[channel] === 1) {
      channelCursors[channel] = null;
      restartPoll();
    }
    if (!polling || (channelCursors[channel] !== null)) {
      return Promise.resolve();
    }
    return new Promise(resolve => {
      channelWaiters[channel] = [ ...(channelWaiters[channel] || []), resolve ];
    });
  }

  // The pending poll may still bring messages for the channel; they are
  // ignored, which spares us a request
  function unsubscribeChannel(channel) {
    if (!channelRefs[channel]) {
      return;
    }
    channelRefs[channel]--;
    if (!channelRefs[channel]) {
      delete channelRefs[channel];
      delete channelCursors[channel];
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
    subscribeChannel,
    unsubscribeChannel,
    pollJob,
    dismiss,
    clearEvent
  };
});
