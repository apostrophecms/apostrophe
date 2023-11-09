import createApp from 'Modules/@apostrophecms/ui/lib/vue';
import TheAposAdminBar from '../components/TheAposAdminBar.vue';

export default function() {
  // Careful, login page is in user scene but has no admin bar
  if (apos.adminBar) {
    const app = createApp(TheAposAdminBar);

    app.mount('#apos-admin-bar');
  }
};

/* { */
/*     el: '#apos-admin-bar', */
/*     computed: { */
/*       apos () { */
/*         return window.apos; */
/*       } */
/*     }, */
/*     render: function (h) { */
/*       return h('TheAposAdminBar', { */
/*         props: { */
/*           items: apos.adminBar.items */
/*         } */
/*       }); */
/*     } */
/*   } */
