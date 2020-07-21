import {
  withKnobs,
  text,
  select,
  boolean,
  number
} from '@storybook/addon-knobs';
import AposNotification from './AposNotification.vue';

export default {
  title: 'All Notifications',
  decorators: [withKnobs]
};

export const notifications = () => ({
  components: { AposNotification },
  props: {
    label: {
      default: text('Label', 'Few can name a disguised punch that isnt a bunchy railway.')
    },
    type: {
      default:
        select(
          'Indicator Type', {
            Default: null,
            Warning: 'warning',
            Success: 'success',
            Danger: 'danger',
            None: 'none'
          },
          null
        )
    },
    icon: {
      default:
        select(
          'Icon', {
            None: null,
            Label: 'label-icon',
            Alert: 'alert-circle-icon',
            Refresh: 'refresh-icon',
            Delete: 'delete-icon',
            'Double Check': 'check-all-icon',
            'Check': 'check-bold-icon',
            'X': 'close-icon',
            'Empty Checkbox': 'checkbox-blank-icon'
          },
          null
        )
    },
    progress: {
      default: boolean('Progress Meter', false)
    },
    progressState: {
      default: number('Progress State', 42, {
        range: true,
        min: 0,
        max: 100
      })
    }
  },
  template: `
    <AposNotification
      :label="label"
      :type="type"
      :icon="icon"
      :progress="progress ? {
        current: progressState
      } : false"
    />
  `
});
