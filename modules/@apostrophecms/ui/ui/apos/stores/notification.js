import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { createId } from '@paralleldrive/cuid2';

export const useNotificationStore = defineStore('notification', () => {
  const notifications = ref([]);
  const dismissed = ref([]);

  async function notify(message, options = {}) {
    if (options.dismiss === true) {
      options.dismiss = 5;
    }

    // Send it to the server, which will send it back to us via
    // the same long polling mechanism that allows it to reach
    // other tabs, and allows server-sent notifications to
    // reach us

    await apos.http.post(apos.notification.action, {
      body: {
        message,
        interpolate: options.interpolate || {},
        type: options.type,
        icon: options.icon,
        dismiss: options.dismiss,
        buttons: options.buttons,
        localize: options.localize
      }
    });
  };

  async function dismiss(notifId) {
    await apos.http.patch(`${apos.notification.action}/${notifId}`, {
      body: {
        dismissed: true
      }
    });
    notifications.value = notifications.value.filter(({ _id }) => notifId !== _id);
  }

  async function poll() {
    try {
      if (document.visibilityState === 'hidden') {
        // Wait for tab to become visible
        setTimeout(poll, 5000);
      } else {
        const allNotifications = [ ...notifications.value, ...dismissed.value ];
        const latestTimestamp = allNotifications
          .map(notification => notification.updatedAt)
          .sort()
          .reverse()[0];

        const seenIds = allNotifications
          .filter(notification => notification.updatedAt === latestTimestamp)
          .map(notification => notification._id);

        const res = await apos.http.get(apos.notification.action, {
          ...(latestTimestamp && {
            qs: {
              modifiedOnOrSince: latestTimestamp,
              seenIds
            }
          })
        });

        notifications.value = [ ...notifications.value, ...(res.notifications || []) ];
        dismissed.value = [ ...dismissed.value, ...(res.dismissed || []) ];
        if (res.dismissed.length) {
          notifications.value = notifications.value.filter(notif => {
            return !res.dismissed.some(element => notif._id === element._id);
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

  return {
    notifications,
    notify,
    poll,
    dismiss
  };
});
