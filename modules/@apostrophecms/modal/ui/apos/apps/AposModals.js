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
      },
      getAt(index) {
        return this.$refs.modals.getAt(index);
      },
      getProperties(id) {
        return this.$refs.modals.getProperties(id);
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
  apos.modal.getAt = theAposModals.getAt;
  apos.modal.getProperties = theAposModals.getProperties;
  apos.modal.stack = [];
  apos.confirm = theAposModals.confirm;
  apos.alert = theAposModals.alert;
}
