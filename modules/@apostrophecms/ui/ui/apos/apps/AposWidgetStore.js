import { useWidgetStore } from 'Modules/@apostrophecms/ui/stores/widget.js';

export default function() {
  const widgetStore = useWidgetStore();
  apos.widget = {
    toId: widgetStore.toId,
    get: widgetStore.get
  };
};
