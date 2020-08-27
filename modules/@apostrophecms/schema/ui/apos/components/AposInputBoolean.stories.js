import {
  withKnobs,
  boolean
} from '@storybook/addon-knobs';

import AposInputBoolean from './AposInputBoolean';

export default {
  title: 'Inputs (Boolean)',
  decorators: [ withKnobs ]
};

export const booleanInput = () => {
  const isDisabled = boolean('Is Disabled?', false);
  const isPrechecked = boolean('Is Pre Checked?', false);
  const customLabels = boolean('Custom Labels', false);

  const field = {
    required: false,
    name: 'approval',
    type: 'radio',
    label: 'Do you approve?',
    help: 'Tell the user a little about this thing',
    disabled: isDisabled,
    toggle: customLabels ? {
      true: 'Published',
      false: 'Unpublished'
    } : false
  };

  return {
    components: {
      AposInputBoolean
    },
    data () {
      return {
        field,
        value: isPrechecked ? {
          data: false
        } : {
          data: null
        }
      };
    },
    template: '<AposInputBoolean :field="field" :value="value" />'
  };
};
