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
    computed: {
      apos() {
        return window.apos;
      }
    },
    async mounted() {
      if (apos.scene !== 'apos') {
        return;
      }

      this.notifications = await this.poll();
      setInterval(async() => {
        this.notifications = await this.poll();
      }, 10000);
    },
    methods: {
      async dismiss(notificationId) {
        await apos.http.delete(`${apos.notification.action}/${notificationId}`, {});
        this.notifications = await this.poll();
      },
      async poll() {
        try {
          const data = await apos.http.get(apos.notification.action, {});
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
          :id="notification._id"
          :dismiss="notification.dismiss"
          :pulse="notification.pulse"
          @close="dismiss"
          />
      </div>`
  });
};
