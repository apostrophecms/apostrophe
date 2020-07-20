import AposSlatList from './AposSlatList.vue';

const items = [
  {
    label: 'Ernie',
    id: 'wefino3390'
  },
  {
    label: 'Bert',
    id: 'wekjfljwenf'
  },
  {
    label: 'Big Bird',
    id: 'ewkl4390'
  },
  {
    label: 'Grover',
    id: 'wefinofewfe3390'
  },
  {
    label: 'Cookie Monster',
    id: 'wekjfljfewefwenf'
  },
  {
    label: 'Oscar the Grouch',
    id: 'ewkl439ewd0'
  }
];

export default {
  title: 'Slat List'
};

export const slatList = () => ({
  components: {
    AposSlatList
  },
  data() {
    return {
      initialItems: items
    };
  },
  template: '<AposSlatList :initialItems="initialItems" />'
});
