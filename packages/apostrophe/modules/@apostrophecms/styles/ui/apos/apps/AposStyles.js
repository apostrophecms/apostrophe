import createApp from 'Modules/@apostrophecms/ui/lib/vue';

export default function() {
  const component = apos.vueComponents.TheAposStyles;
  const isLoggedIn = !!apos.login.user;
  const el = document.querySelector('#apos-styles');
  if (el && window.apos.modules['@apostrophecms/styles'] && isLoggedIn) {
    const app = createApp(component);
    app.mount(el);
  }
}
