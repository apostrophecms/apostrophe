import {
  select,
  optionsKnob as options,
  boolean
} from '@storybook/addon-knobs';

import AposInputString from './AposInputString.vue';

export default {
  title: 'Inputs (String)'
};

export const stringInputs = () => {
  const type = select(
    'Field Type', {
      Text: 'text',
      Time: 'time',
      Date: 'date',
      Textarea: 'textarea'
    },
    null
  );

  const icon = select(
    'Icon', {
      None: null,
      Calendar: 'calendar-icon',
      Search: 'magnify-icon',
      Time: 'clock-icon',
      Phone: 'phone-icon'
    },
    null
  );

  const hasError = boolean('Has Error?', false);
  const hasHelpText = boolean('Has Help Text?', false);
  const isRequired = boolean('Is Required?', false);
  const value = {
    data: ''
  };

  const status = {
    disabled: boolean('Disabled', false),
    error: hasError ? {
      type: 'invalid',
      message: 'Not valid'
    } : false
  };

  const field = {
    name: 'plancksConstant',
    label: 'What is Planck\'s constant?',
    placeholder: 'Enter the number.',
    help: hasHelpText ? 'Sing the Neverending Story theme song.' : false,
    icon: icon,
    required: isRequired
  };

  field.type = type;

  return {
    components: { AposInputString },
    data () {
      return {
        status,
        field,
        value,
        modifiers: options('Modifiers', {
          'Small': 'small',
          'Inverted': 'inverted'
        },
        [],
        { display: 'multi-select' },
        null
        )
      };
    },
    template: `
      <AposInputString
        :field="field"
        :value="value"
        :status="status"
        :modifiers="modifiers"
      />`
  };
};
