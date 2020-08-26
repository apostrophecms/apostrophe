import {
  withKnobs
} from '@storybook/addon-knobs';
import AposWidgetEditor from './AposWidgetEditor.vue';

const data = getData();

export default {
  title: 'Widget Editor ',
  decorators: [ withKnobs ]
};

const typeLabel = 'Marquee';

export const widgetEditor = () => {
  return {
    components: {
      AposWidgetEditor
    },
    data () {
      return {
        schema: data.schema,
        doc: data.doc,
        active: true,
        typeLabel,
        breadcrumbs: [
          {
            href: '#',
            label: 'Marquee'
          }
        ]
      };
    },
    template: `
    <div>
      <button type="button" class="apos-button" @click="toggleActive">
        Activate modal
      </button>
      <AposWidgetEditor
        v-if="active" :schema="schema" :doc="doc"
        :breadcrumbs="breadcrumbs" :typeLabel="typeLabel"
        @safe-close="finishExit"
      />
    </div>
    `,
    methods: {
      toggleActive: function () {
        this.active = !this.active;
      },
      finishExit: function () {
        this.active = false;
      }
    }
  };
};

function getData() {
  return {
    doc: {
      metaText: 'Outrage over police injustice is older than the nation',
      title: 'Porta Magna Egestas',
      description: 'A tip of the internet is assumed to be an unlet baritone. The literature would have us believe that a castled anthony is not but a jaw. Few can name a rimless cook that isn'
    },
    schema: [
      {
        name: 'metaText',
        label: 'Meta Text',
        type: 'string'
      },
      {
        name: 'title',
        label: 'Title',
        type: 'string',
        required: true
      },
      {
        name: 'description',
        label: 'Description',
        type: 'string',
        textarea: true
      }
    ]
  };

}
