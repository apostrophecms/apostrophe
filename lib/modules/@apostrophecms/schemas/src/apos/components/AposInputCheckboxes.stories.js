import { storiesOf } from '@storybook/vue';

import AposInputCheckboxes from './AposInputCheckboxes.vue';

const field = {
  required: true,
  name: 'toppings',
  type: 'checkbox',
  label: 'Which toppings?',
  choices: [
    {
      label: 'Banana peppers',
      value: 'Banana peppers'
    },
    {
      label: 'Mushrooms',
      value: 'Mushrooms'
    },
    {
      label: 'Cold cheese',
      value: 'Cold cheese'
    },
    {
      label: 'Anchovies',
      value: 'Anchovies'
    }
  ]
};

const baseTemplate = '<AposInputCheckboxes :field="field" :value="value" :status="status"/>';

storiesOf('Inputs (Checkbox)', module)
  .add('Checkbox', () => ({
    components: { AposInputCheckboxes },
    data () {
      return {
        field,
        status: {},
        value: {
          data: null
        }
      };
    },
    template: baseTemplate
  }))
  .add('Checkbox (disabled)', () => ({
    components: { AposInputCheckboxes },
    data () {
      return {
        field,
        status: {
          disabled: true
        },
        value: {
          data: null
        }
      };
    },
    template: baseTemplate
  }));
