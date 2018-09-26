import Vue from 'apostrophe/vue';

export default function() {
  /* eslint-disable no-new */
  return new Vue({
    el: '#apos-modals',
    // apos.modals.components.the, apos.modals.modals
    template: `<component :is="'TheApostropheModals'" :modals="[ 'ApostropheModal' ]" />`,
    computed: {
      apos () {
        return window.apos;
      }
    }
  });
};
