import {
  withKnobs,
  select,
  boolean
} from '@storybook/addon-knobs';

import AposInputRelationship from './AposInputRelationship.vue';

export default {
  title: 'Inputs (Relationship)',
  decorators: [ withKnobs ]
};

export const piecesRelationship = () => {

  const max = select(
    'Limit', {
      None: null,
      One: 1,
      Two: 2,
      Three: 3
    },
    null
  );

  const min = select(
    'Minimum', {
      None: null,
      One: 1,
      Two: 2
    },
    null
  );

  const prepopulate = select(
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
    components: { AposInputRelationship },
    data () {
      return {
        field: {
          name: 'myJoin',
          label: 'Link to a Product',
          help: 'Choose a product to link to it',
          type: 'join',
          withType: 'product',
          min,
          max
        },
        value: {
          data: getData(prepopulate)
        },
        status: {
          disabled: isDisabled
        }
      };
    },
    template: `
      <AposInputRelationship
        :field="field"
        :value="value"
        :status="status"
      />`
  };
};

export const mediaRelationship = () => {

  const max = select(
    'Limit', {
      None: null,
      One: 1,
      Two: 2,
      Three: 3
    },
    null
  );

  const min = select(
    'Minimum', {
      None: null,
      One: 1,
      Two: 2
    },
    null
  );

  const isDisabled = boolean('Is Disabled?', false);

  return {
    components: { AposInputRelationship },
    data () {
      return {
        field: {
          name: 'imgJoin',
          label: 'Choose image(s) to display',
          help: 'Choose image(s)',
          type: 'join',
          withType: '@apostrophecms/image',
          min,
          max
        },
        value: {
          data: []
        },
        status: {
          disabled: isDisabled
        }
      };
    },
    template: `
      <AposInputRelationship
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
      type: 'product',
      title: 'Strawberry',
      slug: 'strawberry'
    },
    {
      _id: 'htcuoykl9012j38ecrjgwefwefhrn0c',
      type: 'product',
      title: 'Apple',
      slug: 'apple'
    },
    {
      _id: 'htcuoykwefwefl9012j38ecrjghrn0c',
      type: 'product',
      title: 'Mango',
      slug: 'mango'
    }
  ];
  return data.splice(0, n);
};
