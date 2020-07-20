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
    // apos.modals.components.the, apos.modals.modals
    template: '<component :is="apos.modals.components.the" :modals="apos.modals.modals" />'
  });
};
