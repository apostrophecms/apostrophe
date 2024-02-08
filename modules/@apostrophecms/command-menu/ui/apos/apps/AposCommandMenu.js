import createApp from 'Modules/@apostrophecms/ui/lib/vue';
import TheAposCommandMenu from '../components/TheAposCommandMenu.vue';

export default function() {
  // Careful, login page is in user scene but has no command menu
  const el = document.querySelector('#apos-command-menu');
  if (!apos.commandMenu || !el) {
    return;
  }
  const app = createApp(TheAposCommandMenu, {
    modals: apos.commandMenu.modals
  });
  const theAposCommandMenu = app.mount(el);

  apos.commandMenu.getModal = theAposCommandMenu.getModal;
}
