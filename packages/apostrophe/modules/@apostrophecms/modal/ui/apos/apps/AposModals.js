import createApp from 'Modules/@apostrophecms/ui/lib/vue';
import { useModalStore } from 'Modules/@apostrophecms/ui/stores/modal';

export default function() {
  const component = apos.vueComponents.TheAposModals;
  const el = document.querySelector('#apos-modals');
  if (!el) {
    return;
  }
  const app = createApp(component);
  app.mount(el);

  const modalStore = useModalStore();

  apos.modal.execute = modalStore.execute;
  apos.modal.get = modalStore.get;
  apos.modal.getAt = modalStore.getAt;
  apos.modal.getProperties = modalStore.getProperties;
  apos.modal.onTopOf = modalStore.onTopOf;
  apos.modal.getActiveLocale = modalStore.getActiveLocale;
  apos.confirm = modalStore.confirm;
  apos.alert = modalStore.alert;
  apos.report = modalStore.report;
}
