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
      console.info(`FILTER CHANGE: ${name} = ${value.data}`);
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
        'inputType': 'radio'
      },
      {
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
        'inputType': 'radio'
      },
      {
        'label': 'Color',
        'name': 'color',
        'choices': [
          {
            'value': 'red',
            'label': 'Red'
          },
          {
            'value': 'orange',
            'label': 'Orange'
          },
          {
            'value': 'yellow',
            'label': 'Yellow'
          },
          {
            'value': 'green',
            'label': 'Green'
          },
          {
            'value': 'blue',
            'label': 'Blue'
          },
          {
            'value': 'indigo',
            'label': 'Indigo'
          },
          {
            'value': 'violet',
            'label': 'Violet'
          }
        ],
        'def': 'orange',
        'inputType': 'select'
      }
    ]
  };
}
