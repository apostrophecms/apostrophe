import {
  withKnobs, text, boolean, select, optionsKnob as options
} from '@storybook/addon-knobs';

import AposButton from './AposButton.vue';

export default {
  title: 'Buttons',
  decorators: [ withKnobs ]
};

export const buttons = () => ({
  components: { AposButton },
  props: {
    label: {
      default: text('Label', 'Filter')
    },
    type: {
      default:
        select(
          'Type', {
            Default: null,
            Primary: 'primary',
            Outline: 'outline',
            Subtle: 'subtle',
            Input: 'input',
            Danger: 'danger',
            Quiet: 'quiet',
            RichText: 'rich-text'
          },
          null
        )
    },
    modifiers: {
      default: options('Modifiers', {
        'Danger on Hover': 'danger-on-hover',
        Block: 'block',
        'Gradient on Hover': 'gradient-on-hover',
        'No Border': 'no-border',
        'No Motion': 'no-motion'
      },
      [],
      { display: 'multi-select' },
      null
      )
    },
    disabled: {
      default: boolean('Disabled', false)
    },
    tooltip: {
      default: boolean('Activate Tooltip (on hover)', false)
    },
    busy: {
      default: boolean('Busy', false)
    },
    iconOnly: {
      default: boolean('Icon Only', false)
    },
    icon: {
      default:
        select(
          'Icon', {
            None: null,
            Label: 'label-icon',
            Menu: 'dots-vertical-icon',
            Delete: 'delete-icon',
            'Empty Checkbox': 'checkbox-blank-icon'
          },
          null
        )
    }
  },
  // Margin added to make room for demonstrating tooltip.
  template: `
    <AposButton
      style="margin: 100px;"
      :disabled="disabled"
      :label="label"
      :busy="busy"
      :type="type"
      :icon="icon"
      :iconOnly="iconOnly"
      v-bind:modifiers="modifiers"
      :tooltip="tooltip ? 'Duis mollis, est<br />porttitor ligula.' : null"
    />
  `
});
