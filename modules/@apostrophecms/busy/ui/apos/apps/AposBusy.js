import createApp from 'Modules/@apostrophecms/ui/lib/vue';
import TheAposBusy from '../components/TheAposBusy.vue';

export default function() {
  const el = document.querySelector('#apos-busy');
  if (!el) {
    return;
  }
  const app = createApp(TheAposBusy);
  app.mount(el);
};
