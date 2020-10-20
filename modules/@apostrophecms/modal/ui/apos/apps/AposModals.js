import Vue from 'apostrophe/vue';
import PortalVue from 'portal-vue';
Vue.use(PortalVue);

export default function() {
  const theAposModals = new Vue({
    el: '#apos-modals',
    data() {
      return {
        confirmContent: null,
        confirmResolve: null
      };
    },
    computed: {
      apos () {
        return window.apos;
      }
    },
    methods: {
      confirm(confirmContent) {
        this.confirmContent = confirmContent;
        return new Promise((resolve, reject) => {
          this.confirmResolve = resolve;
        });
      },
      confirmResponse(response) {
        this.confirmContent = null;
        const resolve = this.confirmResolve;
        this.confirmResolve = null;
        return resolve(response);
      }
    },
    template: `<component
      ref="implementation"
      :is="apos.modal.components.the"
      :modals="apos.modal.modals"
      :confirm-content="confirmContent"
      :confirm="apos.modal.components.confirm"
      @confirm-response="confirmResponse"
    />`
  });
  apos.confirm = theAposModals.confirm;
};
