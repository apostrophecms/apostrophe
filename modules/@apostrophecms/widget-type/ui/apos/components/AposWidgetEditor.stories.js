import {
  withKnobs
} from '@storybook/addon-knobs';

export default {
  title: 'Widget Editor ',
  decorators: [ withKnobs ]
};

export const widgetEditor = () => {
  return {
    data () {
      return {
        type: 'address',
        active: true,
        value: {
          _id: 'xyzpdq',
          street1: '1168 E Passyunk Ave',
          city: 'Philadelphia',
          state: 'Pennsylvania',
          zip: '19144',
          country: 'United States'
        },
        breadcrumbs: [
          {
            href: '#',
            label: 'Marquee'
          }
        ],
        options: {}
      };
    },
    template: `
    <div>
      <button type="button" class="apos-button" @click="toggleActive">
        Activate modal
      </button>
      <AposWidgetEditor
        v-if="active" :type="type" :value="value" :options="options"
        :breadcrumbs="breadcrumbs" 
        @safe-close="finishExit"
        @update="update"
      />
    </div>
    `,
    methods: {
      toggleActive() {
        this.active = !this.active;
      },
      finishExit() {
        this.active = false;
      },
      update(value) {
        console.log('Would update:', value);
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
