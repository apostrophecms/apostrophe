import Vue from 'apostrophe/vue';

export default function() {
  /* eslint-disable no-new */
  return new Vue({
    el: '#apos-notification',
    data () {
      return {
        notifications: [],
        ids: []
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

      setInterval(async() => {
        this.notifications = await poll(this.ids);
        this.ids = new Set(this.notifications.map(elem => elem._id));
      }, 10000);

      async function poll(ids) {
        try {
          const data = await apos.http.get(apos.notification.action, {
            body: {
              displayingIds: ids
            }
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
