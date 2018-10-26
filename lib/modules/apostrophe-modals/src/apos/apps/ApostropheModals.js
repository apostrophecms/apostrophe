import Vue from 'vue/dist/vue.js';

export default function() {
  /* eslint-disable no-new */
  return new Vue({
    el: '#apos-modals',
    // apos.modals.components.the, apos.modals.modals
    template: `<component :is="apos.modals.components.the" :modals="apos.modals.modals" />`,
    computed: {
      apos () {
        return window.apos;
      }
    }
  });
};
