// Where the assistant is active: `apos.assistant.browserTools`, the
// registry of browser tool executors (see lib/browser-tools.js), for apps to
// add theirs to, as they add a modal transformer. Apps run once every
// script has loaded and core's before a project's. The panel serves asks
// from the registry itself, so its own tools never depend on this.
//
// A browser tab that has used the assistant follows its chats from page
// load, panel open or not, so it answers the asks of the requests it owns.
// After a navigation the assistant asked for, the panel opens again if it
// was open.

import { pinia } from 'Modules/@apostrophecms/ui/lib/vue';
import { browserTools, readNavigation } from '../lib/browser-tools.js';
import { useAssistantStore } from '../stores/assistant.js';

export default () => {
  if (!window.apos.assistant) {
    return;
  }
  window.apos.assistant.browserTools = browserTools;
  const store = useAssistantStore(pinia);
  const navigation = readNavigation();
  if (!navigation) {
    store.resume();
    return;
  }
  if (navigation.panel) {
    apos.modal.execute('AposAssistant', {});
  }
  store.start();
};
