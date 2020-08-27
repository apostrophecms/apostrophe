import {
  withKnobs,
  select,
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
      _id: 'htcuoykl9012j38ecrjghrn0c',
      published: true,
      trash: false,
      type: 'product',
      title: 'Strawberry',
      slug: 'strawberry',
      price: '$100,000 USD',
      taxes: '$42 USD',
      metaType: 'doc',
      createdAt: '2020-07-20T15:56:19.005Z',
      titleSortified: 'strawberry',
      updatedAt: '2020-07-20T15:56:19.005Z',
      highSearchText: 'strawberry strawberry',
      highSearchWords: [
        'strawberry'
      ],
      lowSearchText: 'strawberry strawberry',
      searchSummary: '',
      docPermissions: [],
      _edit: true
    },
    {
      _id: 'htcuoykl9012j38ecrjgwefwefhrn0c',
      published: true,
      trash: false,
      type: 'product',
      title: 'Apple',
      slug: 'apple',
      price: '$100,000 USD',
      taxes: '$42 USD',
      metaType: 'doc',
      createdAt: '2020-07-20T15:56:19.005Z',
      titleSortified: 'apple',
      updatedAt: '2020-07-20T15:56:19.005Z',
      highSearchText: 'apple apple',
      highSearchWords: [
        'apple'
      ],
      lowSearchText: 'apple apple',
      searchSummary: '',
      docPermissions: [],
      _edit: true
    },
    {
      _id: 'htcuoykwefwefl9012j38ecrjghrn0c',
      published: true,
      trash: false,
      type: 'product',
      title: 'Mango',
      slug: 'mango',
      price: '$100,000 USD',
      taxes: '$42 USD',
      metaType: 'doc',
      createdAt: '2020-07-20T15:56:19.005Z',
      titleSortified: 'mango',
      updatedAt: '2020-07-20T15:56:19.005Z',
      highSearchText: 'mango mango',
      highSearchWords: [
        'mango'
      ],
      lowSearchText: 'mango mango',
      searchSummary: '',
      docPermissions: [],
      _edit: true
    }
  ];
  return data.splice(0, n);
};
