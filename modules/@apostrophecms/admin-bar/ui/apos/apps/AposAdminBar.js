import createApp from 'Modules/@apostrophecms/ui/lib/vue';

export default function() {
  const component = apos.vueComponents.TheAposAdminBar;
  // Careful, login page is in user scene but has no admin bar
  const el = document.querySelector('#apos-admin-bar');
  if (!apos.adminBar || !el || apos?.adminBar.showAdminBar === false) {
    return;
  }
  const app = createApp(component, { items: apos.adminBar.items || [] });
  app.mount(el);
};
