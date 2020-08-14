import { storiesOf } from '@storybook/vue';

import AposDocEditor from './AposDocEditor.vue';

storiesOf('Doc Editor', module)
  .add('Doc Editor', () => ({
    components: {
      AposDocEditor
    },
    data () {
      return {
        moduleName: 'products',
        id: null, // TODO: Add a demo document to the mock API.
        active: true
      };
    },
    template: `
    <div>
      <button type="button" class="apos-button" @click="toggleActive">
        Activate modal
      </button>
      <AposDocEditor
        v-if="active" @safe-close="finishExit"
        :module-name="moduleName" :docId="id"
      />
    </div>
    `,
    methods: {
      log (action) {
        console.log(`Story heard ${action} was clicked`);
      },
      toggleActive: function () {
        this.active = !this.active;
      },
      finishExit: function () {
        this.active = false;
      }
    }
  }));
