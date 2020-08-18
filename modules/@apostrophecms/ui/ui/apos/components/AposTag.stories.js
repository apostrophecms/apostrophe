import { withKnobs, text } from '@storybook/addon-knobs';

import AposTag from './AposTag.vue';

export default {
  title: 'Tags',
  decorators: [withKnobs]
};

export const tags = () => ({
  components: { AposTag },
  props: {
    label: {
      default: text('Label', 'Neighborhood')
    },
    slug: {
      default: text('Slug', 'neighborhood')
    }
  },
  template: '<AposTag :label="label" :slug="slug" />'
});
