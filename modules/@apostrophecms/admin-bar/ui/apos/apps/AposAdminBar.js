import Vue from 'Modules/@apostrophecms/ui/lib/vue';

export default function() {
  // Careful, login page is in user scene but has no admin bar
  if (apos.adminBar) {
    return new Vue({
      el: '#apos-admin-bar',
      computed: {
        apos () {
          return window.apos;
        }
      },
      template: '<component :is="`TheAposAdminBar`" :items="apos.adminBar.items" />'
    });
  }
};
