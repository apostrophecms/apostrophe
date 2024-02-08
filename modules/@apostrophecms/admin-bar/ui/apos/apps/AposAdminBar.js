import createApp from 'Modules/@apostrophecms/ui/lib/vue';
import TheAposAdminBar from '../components/TheAposAdminBar.vue';

export default function() {
  // Careful, login page is in user scene but has no admin bar
  const el = document.querySelector('#apos-admin-bar');
  if (!apos.adminBar || !el) {
    return;
  }

  const app = createApp(TheAposAdminBar, { items: apos.adminBar.items || [] });
  app.mount(el);
};
