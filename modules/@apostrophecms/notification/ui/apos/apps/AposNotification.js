import Vue from 'Modules/@apostrophecms/ui/lib/vue';

export default function() {
  if (!apos.login.user) {
    // The user scene is being used but no one is logged in
    // (example: the login page)
    return;
  }

  return new Vue({
    el: '#apos-notification',
    template: '<TheAposNotifications />'
  });
};
