import Vue from 'Modules/@apostrophecms/ui/lib/vue';

export default function() {
  // Careful, login page is in user scene but has no command menu
  if (apos.commandMenu) {
    const theAposCommandMenu = new Vue({
      el: '#apos-command-menu',
      computed: {
        apos () {
          return window.apos;
        }
      },
      methods: {
        getModal() {
          return this.$refs.commandMenu.modal;
        }
      },
      render(h) {
        return h(
          apos.commandMenu.components.the,
          {
            ref: 'commandMenu',
            props: {
              groups: apos.commandMenu.groups,
              modals: apos.commandMenu.modals
            }
          }
        );
      }
    });

    apos.commandMenu.getModal = theAposCommandMenu.getModal;
  }
}
