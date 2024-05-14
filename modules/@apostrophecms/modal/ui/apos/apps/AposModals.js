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
  const theAposModals = app.mount(el);

  const modalStore = useModalStore();

  apos.modal.execute = modalStore.execute;
  apos.modal.getAt = modalStore.getAt;
  apos.modal.getProperties = modalStore.getProperties;
  apos.modal.onTopOf = onTopOf;
  apos.modal.stack = [];
  apos.confirm = theAposModals.confirm;
  apos.alert = theAposModals.alert;
}

// Returns true if el1 is "on top of" el2 in the
// modal stack, as viewed by the user. If el1 is a
// modal that appears later in the stack than el2
// (visually stacked on top), this method returns true.
// If el2 is `document` and el1 is a modal, this
// method returns true. For convenenience, if el1
// or el2 is not a modal, it is treated as its DOM
// parent modal, or as `document`. If el1 has no
// parent modal this method always returns false.
//
// If el1 is no longer connected to the DOM then it
// is also considered to be "on top" e.g. not something
// that should concern `v-click-outside-element` and
// similar functionality. This is necessary because
// sometimes Vue removes elements from the DOM before
// we can examine their relationships.
function onTopOf(el1, el2) {
  if (el2.matches('[data-apos-menu]')) {
    return false;
  }
  if (!el1.isConnected) {
    // If el1 is no longer in the DOM we can't make a proper determination,
    // returning true prevents unwanted things like click-outside-element
    // events from firing
    return true;
  }
  if (!el1.matches('[data-apos-modal]')) {
    el1 = el1.closest('[data-apos-modal]') || document;
  }
  if (!el2.matches('[data-apos-modal]')) {
    el2 = el2.closest('[data-apos-modal]') || document;
  }
  if (el1 === document) {
    return false;
  }
  if (el2 === document) {
    return true;
  }
  const index1 = apos.modal.stack.findIndex(modal => modal.modalEl === el1);
  const index2 = apos.modal.stack.findIndex(modal => modal.modalEl === el2);
  if (index1 === -1) {
    throw new Error('apos.modal.onTopOf: el1 is not in the modal stack');
  }
  if (index2 === -1) {
    throw new Error('apos.modal.onTopOf: el2 is not in the modal stack');
  }
  return index1 > index2;
}
