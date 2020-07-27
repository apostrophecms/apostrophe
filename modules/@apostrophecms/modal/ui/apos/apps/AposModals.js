import Vue from 'apostrophe/vue';

export default function() {
  /* eslint-disable no-new */
  return new Vue({
    el: '#apos-modals',
    computed: {
      apos () {
        return window.apos;
      }
    },
    // apos.modal.components.the, apos.modal.modals
    template: '<component :is="apos.modal.components.the" :modals="apos.modal.modals" />'
  });
};
