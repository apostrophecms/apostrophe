import { storiesOf } from '@storybook/vue';

import AposDocEditor from './AposDocEditor.vue';

const data = getData();

storiesOf('Doc Editor', module)
  .add('Doc Editor', () => ({
    components: {
      AposDocEditor
    },
    data () {
      return {
        schema: data.schema,
        groups: data.groups,
        doc: data.doc,
        typeLabel: 'Article',
        active: true
      };
    },
    template: `
    <div>
      <button type="button" class="apos-button" @click="toggleActive">
        Activate modal
      </button>
      <AposDocEditor
        v-if="active" @safe-close="finishExit" :typeLabel="typeLabel"
        :schema="schema" :groups="groups" :doc="doc"
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

function getData() {
  return {
    doc: {
      title: 'Outrage over police injustice is older than the nation',
      slug: 'outrage-over-police-injustice-is-older-than-the-nation',
      description: 'A tip of the internet is assumed to be an unlet baritone. The literature would have us believe that a castled anthony is not but a jaw. Few can name a rimless cook that isn',
      trash: false,
      published: true,
      seoTitle: 'In modern times the sphygmic middle comes from a slapstick bamboo.',
      seoDescription: 'Crowing committees show us how scooters can be fonts. This is not to discredit the idea that a bay of the viola is assumed to be an unsailed peripheral.'
    },
    schema: [
      {
        name: 'title',
        label: 'Article Title',
        type: 'string',
        required: true
      },
      {
        name: 'slug',
        label: 'Slug',
        type: 'string',
        required: true
      },
      {
        name: 'description',
        label: 'Description',
        type: 'string',
        textarea: true
      },
      {
        name: 'trash',
        label: 'Trash',
        type: 'boolean'
      },
      {
        name: 'published',
        label: 'Published',
        type: 'boolean'
      },
      {
        name: 'seoDescription',
        label: 'SEO Description',
        type: 'string',
        textarea: true
      },
      {
        name: 'seoTitle',
        label: 'SEO Title',
        type: 'string'
      }
    ],
    groups: {
      firstTab: {
        label: 'First Tab',
        fields: ['title', 'description']
      },
      seoTab: {
        label: 'SEO Tab',
        fields: ['seoTitle', 'seoDescription']
      },
      utility: {
        fields: ['published', 'slug', 'trash']
      }
    }
  };
}
