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
      async confirm(confirmContent, options) {
        return this.execute(apos.modal.components.confirm, {
          confirmContent,
          ...options
        });
      },
      execute(componentName, props) {
        return this.$refs.modals.execute(componentName, props);
      }
    },
    template: `<component
      ref="modals"
      :is="apos.modal.components.the"
      :modals="apos.modal.modals"
    />`
  });
  apos.modal.execute = theAposModals.execute;
  apos.confirm = theAposModals.confirm;
};
