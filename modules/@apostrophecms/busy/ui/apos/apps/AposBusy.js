import Vue from 'apostrophe/vue';

export default function() {
  return new Vue({
    el: '#apos-busy',
    computed: {
      apos () {
        return window.apos;
      }
    },
    template: '<component :is="`TheAposBusy`" />'
  });
};
