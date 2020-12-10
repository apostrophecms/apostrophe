import {
  withKnobs
} from '@storybook/addon-knobs';

import AposInputColor from './AposInputColor';

export default {
  title: 'Inputs (Color)',
  decorators: [ withKnobs ]
};

export const colorInput = () => {

  const field = {
    required: false,
    name: 'theColor',
    type: 'color',
    label: 'Pick a Good One',
    help: 'It could help us'
  };

  return {
    components: {
      AposInputColor
    },
    data () {
      return {
        field,
        value: {
          data: '#f4511e'
        }
      };
    },
    template: '<AposInputColor :field="field" :value="value" />'
  };
};
