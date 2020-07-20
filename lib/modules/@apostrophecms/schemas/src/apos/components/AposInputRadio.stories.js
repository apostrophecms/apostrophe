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

const baseTemplate = '<AposInputRadio :field="field" :value="value" :status="status"/>';

storiesOf('Inputs (Radio)', module)
  .add('Radio', () => ({
    components: { AposInputRadio },
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
  .add('Radio (disabled)', () => ({
    components: { AposInputRadio },
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
