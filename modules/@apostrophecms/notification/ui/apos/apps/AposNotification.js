import createApp from 'Modules/@apostrophecms/ui/lib/vue';
import { useNotificationStore } from 'Modules/@apostrophecms/ui/stores/notification';

export default function() {
  const component = apos.vueComponents.TheAposNotifications;
  const el = document.querySelector('#apos-notification');
  if (!apos.login.user || !el) {
    // The user scene is being used but no one is logged in
    // (example: the login page)
    return;
  }
  const app = createApp(component);
  app.mount(el);

  const notifStore = useNotificationStore();
  apos.notify = notifStore.notify;
  notifStore.poll();
};
