import AposFilterMenu from './AposFilterMenu.vue';

const data = getData();

export default {
  title: 'Filter Context Menu'
};

export const filterContextMenu = () => ({
  components: {
    AposFilterMenu
  },
  methods: {
    log(name, value) {
      console.log(`log: ${name} = ${value.data}`);
    }
  },
  data() {
    return {
      filters: data.filters,
      button: data.button
    };
  },
  template: '<AposFilterMenu :button="button" :filters="filters" @input="log" />'
});

function getData() {
  return {
    button: {
      label: 'Filter',
      icon: 'chevron-down-icon',
      modifiers: [ 'icon-right' ],
      type: 'outline'
    },
    filters: [
      {
        label: 'Published',
        'name': 'published',
        'choices': [
          {
            'value': true,
            'label': 'Published'
          }, {
            'value': false,
            'label': 'Draft'
          }, {
            'value': null,
            'label': 'Both'
          }
        ],
        'def': true,
        'style': 'pill'
      }, {
        label: 'Trash',
        'name': 'trash',
        'choices': [
          {
            'value': false,
            'label': 'Live'
          }, {
            'value': true,
            'label': 'Trash'
          }
        ],
        'def': false,
        'style': 'pill'
      }
    ]
  };
}
