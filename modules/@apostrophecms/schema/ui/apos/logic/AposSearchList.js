export default {
  name: 'AposSearchList',
  props: {
    list: {
      type: Array,
      default() {
        return [];
      }
    },
    hint: {
      type: Object,
      default() {
        return null;
      }
    },
    suggestion: {
      type: Object,
      default() {
        return null;
      }
    },
    ariaId: {
      type: String,
      default: null
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
    },
    focusIndex: {
      type: Number,
      default: null
    }
  },
  emits: [ 'select' ],
  methods: {
    select(item) {
      const selectedItems = this.selectedItems;
      if (!selectedItems.some(selectedItem => selectedItem._id === item._id)) {
        // Never modify a prop
        this.$emit('select', [ ...selectedItems, item ]);
      }
    },
    getClasses(item, index) {
      const classes = {
        'apos-search__item': true
      };
      if (item.disabled) {
        classes['apos-search__item--disabled'] = true;
      }
      item.classes && Array.isArray(item.classes) && item.classes.forEach(suffix => {
        classes[`apos-search__item--${suffix}`] = true;
      });
      if (item.attachment) {
        classes['apos-search__item--attachment'] = true;
      }
      if (index === this.focusIndex) {
        classes['apos-search__item--is-focused'] = true;
      }

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
