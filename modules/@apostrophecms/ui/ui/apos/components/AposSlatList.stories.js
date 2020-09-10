import AposSlatList from './AposSlatList.vue';

const items = [
  {
    title: 'Ernie',
    _id: 'wefino3390'
  },
  {
    title: 'Bert',
    _id: 'wekjfljwenf'
  },
  {
    title: 'Big Bird',
    _id: 'ewkl4390'
  },
  {
    title: 'Grover',
    _id: 'wefinofewfe3390'
  },
  {
    title: 'Cookie Monster',
    _id: 'wekjfljfewefwenf'
  },
  {
    title: 'Oscar the Grouch',
    _id: 'ewkl439ewd0'
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
