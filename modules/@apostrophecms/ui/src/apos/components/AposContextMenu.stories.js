import { storiesOf } from '@storybook/vue';

import AposContextMenu from './AposContextMenu.vue';

const menu = [
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
];

storiesOf('Context Menu', module)
  .add('Default, from below', () => ({
    components: { AposContextMenu },
    data () {
      return { menu };
    },
    template: `
      <div>
        <AposContextMenu
          :menu="menu"
          @item-clicked="log"
        />
        <AposContextMenu
          tip-alignment="center"
          :menu="menu"
          @item-clicked="log"
        />
        <AposContextMenu
          tip-alignment="right"
          :menu="menu"
          @item-clicked="log"
        />
      </div>
    `,
    methods: {
      log (action) {
        console.log(`Story heard ${action} was clicked`);
      }
    }
  }))
  .add('From above', () => ({
    components: { AposContextMenu },
    data () {
      return { menu };
    },
    template: `
      <div style="margin-top: 200px">
        <AposContextMenu
          :menu="menu"
          @item-clicked="log"
          origin="above"
        />
        <AposContextMenu
          tip-alignment="center"
          :menu="menu"
          @item-clicked="log"
          origin="above"
        />
        <AposContextMenu
          tip-alignment="right"
          :menu="menu"
          @item-clicked="log"
          origin="above"
        />
      </div>
    `,
    methods: {
      log (action) {
        console.log(`Story heard ${action} was clicked`);
      }
    }
  }));
