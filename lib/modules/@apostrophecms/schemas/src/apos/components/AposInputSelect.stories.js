import { storiesOf } from '@storybook/vue';

import AposInputSelect from './AposInputSelect.vue';

const field = {
  required: false,
  name: 'mashHousing',
  type: 'select',
  label: 'MASH housing?',
  choices: [
    {
      label: 'Mansion',
      value: 'mansion'
    },
    {
      label: 'Apartment',
      value: 'apartment'
    },
    {
      label: 'Shack',
      value: 'shack'
    },
    {
      label: 'House',
      value: 'house'
    }
  ]
};

const baseTemplate = '<AposInputSelect :field="field" :value="value" :status="status"/>';

storiesOf('Inputs (Select)', module)
  .add('Select', () => ({
    components: { AposInputSelect },
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
  }));
