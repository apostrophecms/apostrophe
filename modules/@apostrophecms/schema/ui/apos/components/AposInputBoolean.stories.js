import { storiesOf } from '@storybook/vue';
import AposInputBoolean from './AposInputBoolean';

const field = {
  required: false,
  name: 'approval',
  type: 'radio',
  label: 'Do you approve?'
};

const toggleField = {
  required: false,
  name: 'approval',
  type: 'radio',
  label: 'Published',
  help: 'Tell the user a little about this thing',
  toggle: {
    true: 'Published',
    false: 'Unpublished'
  }
};

storiesOf('Inputs (Boolean)', module)
  .add('Boolean', () => ({
    components: { AposInputBoolean },
    data () {
      return {
        field,
        value: {
          data: null
        }
      };
    },
    template: '<AposInputBoolean :field="field" :value="value" />'
  }))
  .add('Boolean (prechecked)', () => ({
    components: { AposInputBoolean },
    data () {
      return {
        field,
        value: {
          data: false
        }
      };
    },
    template: '<AposInputBoolean :field="field" :value="value" />'
  }))
  .add('Toggle', () => ({
    components: { AposInputBoolean },
    data () {
      return {
        field: toggleField,
        value: {
          data: false
        }
      };
    },
    template: '<AposInputBoolean :field="field" :value="value" />'
  }));
