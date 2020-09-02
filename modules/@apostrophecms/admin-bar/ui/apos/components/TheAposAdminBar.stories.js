import TheAposAdminBar from './TheAposAdminBar.vue';
import data from './data.js';

export default {
  title: 'Admin Menu'
};

export const adminMenu = () => {
  return {
    data() {
      return {
        menuItems: data.menu
      };
    },
    methods: {
      handler(action) {
        console.log(`heard ${action}`);
      },
      logClick(name) {
        console.info('Admin click 👆', name);
      }
    },
    mounted() {
      apos.bus.$on('admin-menu-click', this.logClick);
    },
    destroyed() {
      apos.bus.$off('admin-menu-click', this.logClick);
    },
    components: {
      TheAposAdminBar
    },
    template: `
      <div>
        <TheAposAdminBar
          :items="menuItems"
          @click="handler"
        />
        </div>
    `
  };
};
