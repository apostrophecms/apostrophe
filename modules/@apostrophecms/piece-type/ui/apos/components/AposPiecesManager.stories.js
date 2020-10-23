import {
  withKnobs
} from '@storybook/addon-knobs';
// No longer needed here, but a good idea to factor this way. -Tom
// import tagListData from 'Modules/@apostrophecms/storybook/mock-data/tagList.js';
// import applyTagData from 'Modules/@apostrophecms/storybook/mock-data/tagApply.js';

export default {
  title: 'Pieces Manager',
  decorators: [ withKnobs ]
};

export const piecesManager = () => {
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
        <AposPiecesManager
          v-if="active" @safe-close="finishExit"
          moduleName="product" @trash="handleTrash"
        />
      </div>
    `
  };
};
