import { select } from '@storybook/addon-knobs';

import AposPagerDots from './AposPagerDots.vue';

export default {
  title: 'Pager Dots'
};

export const dots = () => ({
  components: { AposPagerDots },
  props: {
    dots: {
      default:
        select(
          'Number of Dots', {
            one: 1,
            two: 2,
            three: 3,
            four: 4,
            five: 5,
            six: 6,
            seven: 7
          },
          5
        )
    },
    activeIndex: 2
  },
  methods: {
    clickHandler(index) {
      console.log(`clicked ${index}`);
    }
  },
  template: `
    <AposPagerDots
      :dots="dots"
      :activeIndex="activeIndex"
      v-on:click="clickHandler"
    />
  `
});
