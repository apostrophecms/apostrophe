import createApp from 'Modules/@apostrophecms/ui/lib/vue';
import { useModalStore } from 'Modules/@apostrophecms/ui/stores/modal';

export default function() {
  const component = apos.vueComponents.TheAposModals;
  const el = document.querySelector('#apos-modals');
  if (!el) {
    return;
  }
  const app = createApp(component, {
    modals: apos.modal.modals
  });
  app.mount(el);

  const modalStore = useModalStore();

  apos.modal.execute = modalStore.execute;
  apos.modal.getAt = modalStore.getAt;
  apos.modal.getProperties = modalStore.getProperties;
  apos.modal.onTopOf = modalStore.onTopOf;
  apos.confirm = modalStore.confirm;
  apos.alert = modalStore.alert;
}
