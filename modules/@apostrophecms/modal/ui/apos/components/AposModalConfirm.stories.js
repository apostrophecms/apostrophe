import {
  withKnobs, select
} from '@storybook/addon-knobs';

import AposModalConfirm from './AposModalConfirm.vue';

export default {
  title: 'Confirmation Modal',
  decorators: [ withKnobs ]
};

export const confirmationModal = () => {
  return {
    components: {
      AposModalConfirm
    },
    methods: {
      toggleActive: function () {
        this.active = !this.active;
      },
      finishExit: function () {
        this.active = false;
      },
      confirmed () {
        setTimeout(function () {
          window.alert('CONFIRMED 👍');
        }, 400);
      }
    },
    data () {
      return {
        active: true,
        confirmContent: {
          icon: null,
          heading: 'Trash articles',
          description: 'Are you sure about this?',
          affirmativeLabel: 'Yes, trash them',
          negativeLabel: 'Cancel',
          theme: select(
            'Type', {
              Default: null,
              Danger: 'danger'
            },
            null
          )
        }
      };
    },
    template: `
      <div>
        <button type="button" class="apos-button" @click="toggleActive">
          Activate modal
        </button>
        <AposModalConfirm
          v-if="active" @safe-close="finishExit"
          :confirmContent="confirmContent"
          @confirm="confirmed"
        />
      </div>
    `
  };
};
