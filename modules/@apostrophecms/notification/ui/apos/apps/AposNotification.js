import createApp from 'Modules/@apostrophecms/ui/lib/vue';

export default function() {
  if (!apos.login.user) {
    // The user scene is being used but no one is logged in
    // (example: the login page)
    return;
  }

  return createApp({
    el: '#apos-notification',
    render: function (h) {
      return h('TheAposNotifications');
    }
  });
};
