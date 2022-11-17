import Vue from 'Modules/@apostrophecms/ui/lib/vue';

export default function() {
  return new Vue({
    el: '#apos-command-menu',
    computed: {
      apos () {
        return window.apos;
      }
    },
    async mounted() {
      // TODO remove the following
      // console.log('remove execute AposCommandMenuShortcut on mount event in AposCommandMenu vue app');
      // await apos.modal.execute('AposCommandMenuShortcut', { moduleName: '@apostrophecms/command-menu' });
    },
    methods: {
    },
    render(h) {
      return h(
        apos.commandMenu.components.the,
        {
          ref: 'groups',
          props: {
            groups: apos.commandMenu.groups
          }
        }
      );
    }
  });
}
