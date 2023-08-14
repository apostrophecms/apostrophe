export default {
  name: 'AposSearchList',
  props: {
    list: {
      type: Array,
      default() {
        return [];
      }
    },
    customFields: {
      type: Array,
      default() {
        return [];
      }
    },
    selectedItems: {
      type: Array,
      default() {
        return [];
      }
    },
    disabledTooltip: {
      type: String,
      default: null
    },
    label: {
      type: String,
      default: ''
    },
    help: {
      type: [ String, Object ],
      default: ''
    },
    icon: {
      type: String,
      default: 'text-box-icon'
    },
    iconSize: {
      type: Number,
      default: 20
    },
    fields: {
      type: Array,
      default() {
        return [ 'slug' ];
      }
    }
  },
  emits: [ 'select' ],
  methods: {
    select(item, $event) {
      if (item.disabled) {
        $event.stopPropagation();
        return;
      }
      const selectedItems = this.selectedItems;
      if (!selectedItems.some(selectedItem => selectedItem._id === item._id)) {
        // Never modify a prop
        this.$emit('select', [ ...selectedItems, item ]);
      }
    },
    getClasses(item) {
      const classes = {
        'apos-search__item': true
      };
      if (item.disabled) {
        classes['apos-search__item--disabled'] = true;
      }
      item.classes && Array.isArray(item.classes) && item.classes.forEach(suffix => {
        classes[`apos-search__item--${suffix}`] = true;
      });

      return classes;
    },
    getTooltip(item) {
      return item.disabled && item.tooltip !== false ? this.disabledTooltip : null;
    },
    getIcon(item) {
      return {
        icon: item.icon ?? this.icon,
        iconSize: item.iconSize || this.iconSize
      };
    }
  }
};
