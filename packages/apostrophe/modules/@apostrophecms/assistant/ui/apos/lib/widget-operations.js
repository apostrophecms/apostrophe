// The widget menu entries the assistant adds (`apos.assistant
// .addWidgetOperation`): the widgets are the selection already, so a click
// opens the panel and asks its composer for the entry's prompt.

import { useModalStore } from 'Modules/@apostrophecms/ui/stores/modal';
import { pinia } from 'Modules/@apostrophecms/ui/lib/vue';
import { useAssistantStore } from '../stores/assistant.js';

export function listenForWidgetOperations() {
  apos.bus.$on('assistant-widget-operation', ({ name, widgetIds } = {}) => {
    // The bus is shared: only an entry of ours, for at least one widget
    const prompt = Object.hasOwn(window.apos.assistant.widgetOperations || {}, name) &&
      window.apos.assistant.widgetOperations[name];
    const count = Array.isArray(widgetIds) ? widgetIds.length : 0;
    if (!prompt || !count) {
      return;
    }
    const store = useAssistantStore(pinia);
    // Its chat tabs first, so the prompt goes to the one the panel shows
    store.start();
    store.askPrompt(prompt, count);
    const open = useModalStore(pinia).stack
      .some(({ componentName }) => componentName === 'AposAssistant');
    if (!open) {
      apos.modal.execute('AposAssistant', {});
    }
  });
}
