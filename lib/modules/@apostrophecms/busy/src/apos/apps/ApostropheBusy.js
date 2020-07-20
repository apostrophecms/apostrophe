import Vue from 'apostrophe/vue';

export default function() {
  /* eslint-disable no-new */
  return new Vue({
    el: '#apos-busy',
    computed: {
      apos () {
        return window.apos;
      }
    },
    template: '<component :is="`TheApostropheBusy`" />'
  });
};
