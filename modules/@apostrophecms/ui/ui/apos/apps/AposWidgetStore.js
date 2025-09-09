import { useWidgetStore } from 'Modules/@apostrophecms/ui/stores/widget.js';

export default function() {
  const widgetStore = useWidgetStore();
  apos.widget = {
    refs: widgetStore.refs,
    toId: widgetStore.toId,
    get: widgetStore.get,
    set: widgetStore.set,
    getOrSet: widgetStore.getOrSet,
    update: widgetStore.update,
    remove: widgetStore.remove
  };
};
