import createApp from 'Modules/@apostrophecms/ui/lib/vue';
import TheAposCommandMenu from '../components/TheAposCommandMenu.vue';

export default function() {
  // Careful, login page is in user scene but has no command menu
  if (apos.commandMenu) {
    const app = createApp(TheAposCommandMenu);
    const theAposCommandMenu = app.mount('#apos-command-menu');

    apos.commandMenu.getModal = theAposCommandMenu.getModal;
  }
}
