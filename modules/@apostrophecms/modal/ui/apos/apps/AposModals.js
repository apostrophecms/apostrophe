import Vue from 'apostrophe/vue';
import cuid from 'cuid';

export default function() {
  const theAposModals = new Vue({
    el: '#apos-modals',
    computed: {
      apos () {
        return window.apos;
      }
    },
    methods: {
      async confirm(confirmContent) {
        return this.execute(apos.modal.components.confirm, {
          confirmContent
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
  apos.bus.$on('content-changed', async () => {
    const content = await apos.http.get(`${window.location.href}?apos_refresh=${cuid()}`, {});
    const refreshable = document.querySelector('[data-apos-refreshable]');
    if (refreshable) {
      refreshable.innerHTML = content;
    }
  });
};
