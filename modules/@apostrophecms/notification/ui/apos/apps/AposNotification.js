import createApp from 'Modules/@apostrophecms/ui/lib/vue';
import TheAposNotifications from '../components/TheAposNotifications.vue';

export default function() {
  if (!apos.login.user) {
    // The user scene is being used but no one is logged in
    // (example: the login page)
    return;
  }

  const app = createApp(TheAposNotifications);

  app.mount('#apos-notification');
};
