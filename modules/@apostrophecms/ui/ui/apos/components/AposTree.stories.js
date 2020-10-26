import { withKnobs } from '@storybook/addon-knobs';

import AposTree from './AposTree.vue';
import { LoremIpsum } from 'lorem-ipsum';

let draggable = false;
let bulkSelect = false;

const data = getData();

export default {
  title: 'Tree',
  decorators: [ withKnobs ]
};

export const Tree = () => ({
  components: { AposTree },
  data() {
    return {
      data,
      checked: []
    };
  },
  methods: {
    setBusy(val) {
      console.info('Busy state is ', val);
    },
    update(obj) {
      // We'll hit a route here to update the docs.
      console.info('CHANGED ROW:', obj);
    }
  },
  template: `
    <AposTree
      :headers="data.headers"
      :icons="data.icons"
      :items="data.items"
      :options="{
        draggable: true,
        bulkSelect: true
      }"
      v-model="checked"
      @update="update" @busy="setBusy"
    />
  `
});

function getData () {
  const items = generateRows(randomNumber());
  return {
    headers: [
      {
        label: 'Title',
        action: 'title-desc',
        name: 'title'
      },
      {
        label: 'Last Updated',
        action: 'updated-at-desc',
        labelIcon: 'calendar',
        name: 'updatedAt'
      },
      {
        label: 'Link',
        name: 'url',
        icon: 'link',
        iconOnly: true
      }
    ],
    icons: {
      calendar: 'calendar-icon',
      circle: 'circle-icon',
      link: 'link-icon'
    },
    items,
    draggable,
    bulkSelect
  };
}

function generateRows(number) {
  const data = [];

  for (let i = 0; i < number; i++) {
    const row = generateRow();
    data.push(row);
  }

  return data;
}

function generateRow(maxDepth = 5) {
  const lorem = new LoremIpsum({
    wordsPerSentence: {
      max: 8,
      min: 2
    }
  });

  const title = lorem.generateSentences(1);
  const id = title.toLowerCase().replace(' ', '-');

  const item = {
    _id: id,
    title,
    updatedAt: randomDay(),
    url: `/${id}`,
    // Even items without children need to have an `children` array eventually.
    // This is to support dragging other items into them as children.
    children: []
  };

  if (randomBoolean(0.3)) {
    draggable = true;
    bulkSelect = true;
    for (let i = 0; i < randomNumber(); i++) {
      if (maxDepth > i) {
        const child = generateRow(i);
        item.children.push(child);
      } else {
        delete item.children;
      }
    }
  }

  return item;
}

function randomDay() {
  const weekdays = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday'
  ];
  const months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December'
  ];
  const days = [ ...Array(31).keys() ];
  const years = [ 2018, 2019, 2020, 2021 ];
  return `${weekdays[randomItem(weekdays)]}
    ${months[randomItem(months)]}
    ${days[randomItem(days)]},
    ${years[randomItem(years)]}`.replace(/[\n][\s]+/g, ' ');
}

function randomNumber(min = 1, max = 10) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomBoolean(threshold = 0.4) {
  return Math.random() >= threshold;
}

function randomItem(arr) {
  return Math.floor(Math.random() * arr.length);
}
