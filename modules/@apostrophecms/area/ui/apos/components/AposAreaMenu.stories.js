import {
  withKnobs,
  boolean
} from '@storybook/addon-knobs';

import AposAreaMenu from './AposAreaMenu.vue';
const data = getData();

export default {
  title: 'Area Menu',
  decorators: [ withKnobs ]
};

export const areaMenu = () => {
  const menuFormat = boolean('Menu Items Grouped?', true);
  return {
    data() {
      return {
        index: 0,
        widgetOptions: {
          '@apostrophecms/rich-text': {}
        }
      };
    },
    methods: {
      handler(action) {
        console.log(`heard ${action}`);
      }
    },
    computed: {
      contextMenuOptions() {
        if (menuFormat) {
          return { menu: data.menu };
        } else {
          return { menu: data.menu[1].items };
        }
      }
    },
    components: {
      AposAreaMenu
    },
    template: `
      <AposAreaMenu
        @click="handler"
        :contextMenuOptions="contextMenuOptions"
        :widgetOptions="widgetOptions"
        style="margin-left: 100px;"
      />
    `
  };
};

function getData() {
  return {
    menu: [
      {
        label: 'Layouts',
        items: [
          {
            label: 'Two Column',
            action: 'add-two-column',
            icon: 'view-column-icon'
          },
          {
            label: 'Three Column',
            action: 'add-three-column',
            icon: 'view-column-icon'
          },
          {
            label: 'Two Thirds',
            action: 'add-two-thirds',
            icon: 'view-column-icon'
          },
          {
            label: 'Quarter',
            action: 'add-quarters',
            icon: 'view-column-icon'
          }
        ]
      },
      {
        label: 'Content Widgets',
        items: [
          {
            label: 'Marquee',
            action: 'add-marquee',
            icon: 'image-size-select-actual-icon'
          },
          {
            label: 'Image',
            action: 'add-image',
            icon: 'image-icon'
          },
          {
            label: 'Video',
            action: 'add-video',
            icon: 'video-icon'
          },
          {
            label: 'Instagram Feed',
            action: 'add-insta-feed',
            icon: 'instagram-icon'
          },
          {
            label: 'Cool API Thing',
            action: 'add-api-thing',
            icon: 'web-icon'
          }
        ]
      },
      {
        label: 'Two Column',
        action: 'add-two-column',
        icon: 'view-column-icon'
      },
      {
        label: 'Three Column',
        action: 'add-three-column',
        icon: 'view-column-icon'
      },
      {
        label: 'Marquee',
        action: 'add-marquee',
        icon: 'image-size-select-actual-icon'
      },
      {
        label: 'Image',
        action: 'add-image',
        icon: 'image-icon'
      },
      {
        label: 'Video',
        action: 'add-video',
        icon: 'video-icon'
      },
      {
        label: 'Instagram Feed',
        action: 'add-insta-feed',
        icon: 'instagram-icon'

      },
      {
        label: 'Cool API Thing',
        action: 'add-api-thing',
        icon: 'web-icon'
      }
    ]
  };
}
