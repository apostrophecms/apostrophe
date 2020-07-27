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
      }
    },
    components: {
      TheAposAdminBar
    },
    template: `
      <div>
        <TheAposAdminBar v-on:click="handler" :items="menuItems" />
      </div>
    `
  };
};
