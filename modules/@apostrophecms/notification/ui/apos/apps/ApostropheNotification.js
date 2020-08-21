import Vue from 'apostrophe/vue';
import { forEach } from 'lodash';

export default function() {
  /* eslint-disable no-new */
  return new Vue({
    el: '#apos-notification',
    data () {
      return {
        notifications: [],
        latest: null
      };
    },
    computed: {
      apos() {
        return window.apos;
      }
    },
    async mounted() {
      if (apos.scene !== 'apos') {
        return;
      }

      this.notifications = await poll(this.latest);
      this.latest = this.notifications
        .map(notification => notification.createdAt)
        .sort()
        .reverse()[0];
      setInterval(async() => {
        this.notifications = await poll(this.latest);
        this.latest = this.notifications
          .map(notification => notification.createdAt)
          .sort()
          .reverse()[0];
      }, 10000);

      async function poll(latest) {
        try {
          const data = await apos.http.get(apos.notification.action, {
            qs: { latest }
          });

          return data.notifications || [];
        } catch (err) {
          console.error(err);
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
          />
      </div>`
  });
};
