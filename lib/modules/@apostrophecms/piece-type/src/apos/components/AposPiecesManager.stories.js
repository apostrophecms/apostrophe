import {
  withKnobs
} from '@storybook/addon-knobs';
import AposPiecesManager from './AposPiecesManager.vue';
import tagListData from '../tagList/data.js';
import applyTagData from '../tagApplyMenu/data.js';

export default {
  title: 'Pieces Manager',
  decorators: [withKnobs]
};

export const piecesManager = () => {
  return {
    components: {
      AposPiecesManager
    },
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
        active: true,
        tagList: tagListData,
        applyTags: applyTagData.applyTo,
        pieceType: {
          label: 'Document',
          pluralLabel: 'Documents'
        }
      };
    },
    template: `
      <div>
        <button type="button" class="apos-button" @click="toggleActive">
          Activate modal
        </button>
        <AposPiecesManager
          v-if="active" @safe-close="finishExit"
          :tagList="tagList"
          :applyTags="applyTags" :pieceType="pieceType" @trash="handleTrash"
          @sort="log"
        />
      </div>
    `
  };
};
