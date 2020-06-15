import Vue from 'apostrophe/vue';

export default function() {
  /* eslint-disable no-new */
  return new Vue({
    el: '#apos-overlay',
    template: '<component :is="`TheApostropheOverlay`" />',
    computed: {
      apos () {
        return window.apos;
      }
    }
  });
};
