import AposContextMenu from './AposContextMenu.vue';
import {
  withKnobs, select
} from '@storybook/addon-knobs';

export default {
  title: 'Context Menu',
  decorators: [ withKnobs ]
};

export const contextMenu = () => ({
  components: {
    AposContextMenu
  },
  methods: {
    log (action) {
      console.log(`Story heard ${action} was clicked`);
    }
  },
  data() {
    const data = getData();
    return {
      menu: data.menu,
      menuPlacement: select(
        'Menu Placement', {
          top: 'top',
          'top-start': 'top-start',
          'top-end': 'top-end',
          bottom: 'bottom',
          'bottom-start': 'bottom-start',
          'bottom-end': 'bottom-end'
        },
        'top'
      )
    };
  },
  template: `
    <div style="padding: 300px;">
      <AposContextMenu
        :menu="menu"
        @item-clicked="log"
        :menuPlacement="menuPlacement"
      />
    </div>
  `
});

function getData() {
  return {
    menu: [
      {
        label: 'New Page',
        action: 'new-page'
      },
      {
        label: 'New Event',
        action: 'new-event'
      },
      {
        label: 'New Project',
        action: 'new-project'
      },
      {
        label: 'New Staff Member',
        action: 'new-staff-member'
      },
      {
        label: 'New Article',
        action: 'new-article'
      }
    ]
  };
}
