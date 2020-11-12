import Vue from 'apostrophe/vue';
import PortalVue from 'portal-vue';
Vue.use(PortalVue);

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
    const content = await apos.http.get(window.location.href, {
      headers: {
        'Cache-Control': 'no-cache',
        'Apostrophe-Refresh': 'true'
      }
    });
    const refreshable = document.querySelector('[data-apos-refreshable]');
    if (refreshable) {
      refreshable.innerHTML = content;
    }
  });
};
