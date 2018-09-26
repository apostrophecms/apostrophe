import Vue from 'apostrophe/vue';

export default function() {
  /* eslint-disable no-new */
  return new Vue({
    el: '#apos-admin-bar',
    template: '<component :is="`TheApostropheAdminBar`" />'
  });
};
