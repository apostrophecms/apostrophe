import createApp from 'Modules/@apostrophecms/ui/lib/vue';
import TheAposNotifications from '../components/TheAposNotifications.vue';

export default function() {
  const el = document.querySelector('#apos-notification');
  if (!apos.login.user || !el) {
    // The user scene is being used but no one is logged in
    // (example: the login page)
    return;
  }

  const app = createApp(TheAposNotifications);

  app.mount(el);
};
