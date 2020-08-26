import Vue from 'apostrophe/vue';

export default function() {
  /* eslint-disable no-new */
  return new Vue({
    el: '#apos-notification',
    data () {
      return {
        notifications: []
      };
    },
    async mounted() {
      apos.notify = async function(message, options) {
        const strings = [];
        let i = 1;
        let index = 0;
        while (true) {
          index = message.indexOf('%s', index);
          if (index === -1) {
            break;
          }
          // Don't match the same one over and over
          index += 2;
          if ((i >= arguments.length) || ((typeof (arguments[i]) === 'object'))) {
            throw new Error('Bad notification call: number of %s placeholders does not match number of string arguments after message');
          }
          strings.push(arguments[i++]);
        }
        if ((i === (arguments.length - 1)) && (typeof (arguments[i]) === 'object')) {
          options = arguments[i++];
        } else {
          options = {};
        }

        if (i !== arguments.length) {
          throw new Error('Bad notification call: number of %s placeholders does not match number of string arguments after message');
        }

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
            strings,
            type: options.type,
            dismiss: options.dismiss,
            pulse: options.pulse,
            id: options.id
          }
        });
      };

      await this.poll();
    },
    methods: {
      async dismiss(notificationId) {
        await apos.http.patch(`${apos.notification.action}/${notificationId}`, {
          body: {
            dismissed: true
          }
        });
        this.notifications = this.notifications.reduce((acc, cur) => {
          if (cur._id !== notificationId) {
            acc.push(cur);
          }
          return acc;
        }, []);
      },
      async poll() {
        try {
          const latestTimestamp = this.notifications
            .map(notification => notification.createdAt)
            .sort()
            .reverse()[0];

          const data = await apos.http.get(apos.notification.action, {
            ...(latestTimestamp && { qs: { modifiedOnOrSince: latestTimestamp } })
          });

          this.notifications = [...this.notifications, ...(data.notifications || [])];
        } catch (err) {
          console.error(err);
        } finally {
          this.poll();
        }
      }
    },
    template:
      `<div class="apos-notifications">
        <component
          v-for="notification in notifications"
          is="AposNotification"
          :key="notification._id"
          :label="notification.message"
          :type="notification.type"
          :id="notification._id"
          :dismiss="notification.dismiss"
          :pulse="notification.pulse"
          @close="dismiss"
        />
      </div>`
  });
};
