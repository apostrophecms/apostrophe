import {
  withKnobs,
  select,
  optionsKnob as options,
  boolean
} from '@storybook/addon-knobs';

import AposInputJoin from './AposInputJoin.vue';

export default {
  title: 'Inputs (Join)',
  decorators: [ withKnobs ]
};

export const joinInput = () => {

  const max = select(
    'Limit', {
      None: null,
      One: 1,
      Two: 2,
      Three: 3
    },
    null
  );

  const prepoulate = select(
    'Prepopulate', {
      None: 0,
      One: 1,
      Two: 2,
      Three: 3
    },
    null
  );

  const isDisabled = boolean('Is Disabled?', false);

  return {
    components: { AposInputJoin },
    data () {
      return {
        field: {
          name: 'myJoin',
          label: 'Link to A Page',
          help: 'Choose a page from the joiner to link to it',
          type: 'join',
          withType: 'product',
          max
        },
        value: {
          data: getData(prepoulate)
        },
        status: {
          disabled: isDisabled
        }
      };
    },
    template: `
      <AposInputJoin
        :field="field"
        :value="value"
        :status="status"
      />`
  };
};

function getData(n) {
  const data = [
    {
      '_id': 'htcuoykl9012j38ecrjghrn0c',
      'published': true,
      'trash': false,
      'type': 'product',
      'title': 'Strawberry',
      'slug': 'strawberry',
      'metaType': 'doc'
    },
    {
      '_id': 'htcuoykl9012j38ecrjgwefwefhrn0c',
      'published': true,
      'trash': false,
      'type': 'product',
      'title': 'Apple',
      'slug': 'apple',
      'metaType': 'doc'
    },
    {
      '_id': 'htcuoykwefwefl9012j38ecrjghrn0c',
      'published': true,
      'trash': false,
      'type': 'product',
      'title': 'Mango',
      'slug': 'mango',
      'metaType': 'doc'
    }
  ];
  return data.splice(0, n);
};
