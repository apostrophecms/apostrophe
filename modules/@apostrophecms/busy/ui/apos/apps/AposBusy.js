import Vue from 'apostrophe/vue';

export default function() {
  return new Vue({
    el: '#apos-busy',
    template: '<component :is="`TheAposBusy`" />'
  });
};
