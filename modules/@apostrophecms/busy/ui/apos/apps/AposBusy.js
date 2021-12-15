import Vue from 'Modules/@apostrophecms/ui/lib/vue';

export default function() {
  return new Vue({
    el: '#apos-busy',
    render: function (h) {
      return h('TheAposBusy');
    }
  });
};
