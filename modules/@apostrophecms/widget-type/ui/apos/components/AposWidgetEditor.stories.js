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
