import {
  withKnobs
} from '@storybook/addon-knobs';

export default {
  title: 'Relationships Manager',
  decorators: [ withKnobs ]
};

export const relationshipsManager = () => {
  return {
    methods: {
      handleTrash(selected) {
        console.log(`trash ${selected}`);
      },
      log(action) {
        console.log(`sort by ${action}`);
      },
      toggleActive: function () {
        this.active = !this.active;
      },
      finishExit: function () {
        this.active = false;
      }
    },
    data () {
      return {
        active: true
      };
    },
    template: `
      <div>
        <button type="button" class="apos-button" @click="toggleActive">
          Activate modal
        </button>
        <AposRelationshipsManager
          v-if="active" @safe-close="finishExit"
          moduleName="product" @trash="handleTrash"
          @sort="log"
        />
      </div>
    `
  };
};
