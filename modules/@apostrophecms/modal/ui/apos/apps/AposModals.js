import Vue from 'Modules/@apostrophecms/ui/lib/vue';

export default function() {
  const theAposModals = new Vue({
    el: '#apos-modals',
    computed: {
      apos () {
        return window.apos;
      }
    },
    methods: {
      async confirm(content, options = {}) {
        return this.execute(apos.modal.components.confirm, {
          content,
          mode: 'confirm',
          options
        });
      },
      async alert(alertContent, options = {}) {
        return this.execute(apos.modal.components.confirm, {
          content: alertContent,
          mode: 'alert',
          options
        });
      },
      execute(componentName, props) {
        return this.$refs.modals.execute(componentName, props);
      }
    },
    render(h) {
      return h(apos.modal.components.the, {
        ref: 'modals',
        props: {
          modals: apos.modal.modals
        }
      });
    }
  });
  apos.modal.execute = theAposModals.execute;
  apos.confirm = theAposModals.confirm;
  apos.alert = theAposModals.alert;
};
