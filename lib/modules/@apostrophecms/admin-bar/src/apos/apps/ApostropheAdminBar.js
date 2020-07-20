import Vue from 'apostrophe/vue';

export default function() {
  // Careful, login page is in user scene but has no admin bar
  if (apos.adminBar) {
    /* eslint-disable no-new */
    return new Vue({
      el: '#apos-admin-bar',
      computed: {
        apos () {
          return window.apos;
        }
      },
      template: '<component :is="`TheApostropheAdminBar`" :items="apos.adminBar.items" />'
    });
  }
};
