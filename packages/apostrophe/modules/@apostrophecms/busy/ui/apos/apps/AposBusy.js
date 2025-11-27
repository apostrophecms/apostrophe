import createApp from 'Modules/@apostrophecms/ui/lib/vue';

export default function() {
  const component = apos.vueComponents.TheAposBusy;
  const el = document.querySelector('#apos-busy');
  if (!el) {
    return;
  }
  const app = createApp(component);
  app.mount(el);
};
