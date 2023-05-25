import createApp from 'Modules/@apostrophecms/ui/lib/vue';

export default function() {
  return createApp({
    el: '#apos-busy',
    render: function (h) {
      return h('TheAposBusy');
    }
  });
};
