// TODO: Reconcile the overlap in this mixin between the pages and pieces
// managers. Does it need to be a mixin? This may be resolved when switching to
// Vue 3 using the composition API. - AB
export default {
  data() {
    return {
      icons: {},
      // If passing in selected items from the relationship input, use those
      // as initially checked.
      checked: this.selected ? this.selected.map(item => item._id) : []
    };
  },
  props: {
    selected: {
      type: Array,
      default: false
    },
    // TODO: Disable unchecked checkboxes if hit field.max
    relationshipField: {
      type: Object,
      default: false
    }
  },
  computed: {
    headers() {
      return this.options.columns ? this.options.columns : [];
    },
    selectAllValue() {
      return this.checked.length > 0 ? { data: [ 'checked' ] } : { data: [] };
    },
    selectAllChoice() {
      const checkCount = this.checked.length;
      const itemCount = this.items.length;

      return checkCount > 0 && checkCount !== itemCount ? {
        value: 'checked',
        indeterminate: true
      } : {
        value: 'checked'
      };
    },
    selectAllState() {
      if (this.selectAllValue.data.length && !this.selectAllChoice.indeterminate) {
        return 'checked';
      }
      if (this.selectAllValue.data.length && this.selectAllChoice.indeterminate) {
        return 'indeterminate';
      }
      return 'empty';
    }
  },
  watch: {
    items: function(newValue) {
      if (newValue.length) {
        this.generateUi();
      }
    }
  },
  methods: {
    toggleRowCheck(id) {
      if (this.checked.includes(id)) {
        this.checked = this.checked.filter(item => item !== id);
      } else {
        this.checked.push(id);
      }
    },
    selectAll(event) {
      if (!this.checked.length) {
        this.items.forEach((item) => {
          this.toggleRowCheck(item._id);
          if (this.updateSelectedItems) {
            // Update selected items in the relationships manager.
            this.updateSelectedItems(item._id);
          }
        });
        return;
      }

      if (this.checked.length <= this.items.length) {
        this.checked.forEach((id) => {
          this.toggleRowCheck(id);
        });
      }
    },
    iconSize(header) {
      if (header.icon) {
        if (header.icon === 'Circle') {
          return 8;
        } else {
          return 10;
        }
      }
    },
    sort(action) {
      this.$emit('sort', action);
    },
    generateUi () {
      this.generateIcons();
    },
    generateIcons () {
      // fetch all icons used in table headers
      const icons = {};
      this.headers.forEach(h => {
        if (h.icon) {
          icons[h.icon] = `${h.icon.toLowerCase()}-icon`;
        }

        if (h.labelIcon && !icons[h.labelIcon]) {
          icons[h.labelIcon] = `${h.labelIcon.toLowerCase()}-icon`;
        }
      });
      this.icons = icons;
      // prep item checkbox fields
    },
    saveRelationship() {
      const chosenItems = this.items.filter(item => {
        return this.checked.includes(item._id);
      });
      this.$emit('chose', chosenItems);
      if (this.cancel) {
        // DocsManagers must also be modal parents with the
        // AposModalParentMixin methods available.
        this.cancel();
      }
    }
  }
};
