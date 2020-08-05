import { storiesOf } from '@storybook/vue';

import AposInputRadio from './AposInputRadio.vue';

const field = {
  required: true,
  name: 'turtleLeads',
  type: 'radio',
  label: 'He\'s the leader',
  choices: [
    {
      label: 'Michelangelo',
      value: 'Michelangelo'
    },
    {
      label: 'Donatello',
      value: 'Donatello',
      indeterminate: true
    },
    {
      label: 'Leonardo',
      value: 'Leonardo'
    },
    {
      label: 'Raphael',
      value: 'Raphael'
    }
  ]
};

const field2 = {
  ...field,
  disabled: true
};

const baseTemplate = '<AposInputRadio :field="field" :value="value" />';

storiesOf('Inputs (Radio)', module)
  .add('Radio', () => ({
    components: { AposInputRadio },
    data () {
      return {
        field,
        value: {
          data: null
        }
      };
    },
    template: baseTemplate
  }))
  .add('Radio (disabled)', () => ({
    components: { AposInputRadio },
    data () {
      return {
        field: field2,
        value: {
          data: null
        }
      };
    },
    template: baseTemplate
  }));
