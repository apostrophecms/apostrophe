import createApp from 'Modules/@apostrophecms/ui/lib/vue';
import TheAposBusy from '../components/TheAposBusy.vue';

export default function() {
  const app = createApp(TheAposBusy);
  app.mount('#apos-busy');
};
