import { detectDocChange } from 'Modules/@apostrophecms/schema/lib/detectChange';

// TODO: Reconcile the overlap in this mixin between the pages and pieces
// managers. Does it need to be a mixin? This may be resolved when switching to
// Vue 3 using the composition API. - AB

import klona from 'klona';

export default {
  data() {
    return {
      icons: {},
      // If passing in chosen items from the relationship input, use those
      // as initially checked.
      checked: Array.isArray(this.chosen) ? this.chosen.map(item => item._id)
        : [],
      checkedDocs: Array.isArray(this.chosen) ? klona(this.chosen) : false
    };
  },
  props: {
    chosen: {
      type: [ Array, Boolean ],
      default: false
    },
    relationshipField: {
      type: [ Object, Boolean ],
      default: false
    }
  },
  emits: [ 'modal-result' ],
  computed: {
    relationshipErrors() {
      if (!this.relationshipField) {
        return false;
      }

      if (this.relationshipField.min && this.checked.length < this.relationshipField.min) {
        return 'min';
      }

      if (this.relationshipField.max && this.checked.length >= this.relationshipField.max) {
        return 'max';
      }

      return false;
    },
    sort(action) {
      this.$emit('sort', action);
    },
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
    },
    checked () {
      if (!this.checkedDocs) {
        return;
      }
      this.updateCheckedDocs();
    }
  },
  methods: {
    selectAll() {
      if (!this.checked.length) {
        this.items.forEach((item) => {
          if (this.relationshipField && this.relationshipErrors === 'max') {
            return;
          }

          this.checked.push(item._id);
        });
        return;
      }

      if (this.checked.length <= this.items.length) {
        this.checked.forEach((id) => {
          this.checked = this.checked.filter(item => item !== id);
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
      this.$emit('modal-result', this.checkedDocs);
      this.modal.showModal = false;
    },
    // Default implementation of isModified is based on whether the
    // selection has changed, but you can override this and combine
    // that bit with your own if your manager allows in-context editing
    // of a piece (i.e. AposMediaManager)
    isModified() {
      return this.relationshipIsModified();
    },
    // Easy to reuse if you have a custom isModified method
    relationshipIsModified() {
      if (!this.relationshipField) {
        return false;
      }
      if (this.chosen.length !== this.checkedDocs.length) {
        return true;
      }
      for (let i = 0; (i < this.chosen.length); i++) {
        if (this.chosen[i]._id !== this.checkedDocs[i]._id) {
          return true;
        }
        if (this.relationshipField.schema) {
          if (detectDocChange(this.relationshipField.schema, this.chosen[i]._fields, this.checkedDocs[i]._fields)) {
            return true;
          }
        }
      }
    },
    // update this.checkedDocs based on this.checked. The default
    // implementation is suitable for paginated lists. Can be overridden
    // for other cases.
    updateCheckedDocs() {
      // Keep `checkedDocs` in sync with `checked`, first removing from
      // `checkedDocs` if no longer in `checked`
      this.checkedDocs = this.checkedDocs.filter(doc => {
        return this.checked.includes(doc._id);
      });
      // then adding to `checkedDocs` if not there yet. These should be in
      // `items` which is assumed to contain a flat list of items currently
      // visible.
      //
      // TODO: Once we have the option to select all docs of a type even if not
      // currently visible in the manager this will need to make calls to the
      // database.
      this.checked.forEach(id => {
        if (this.checkedDocs.findIndex(doc => doc._id === id) === -1) {
          this.checkedDocs.push(this.items.find(item => item._id === id));
        }
      });

    }
  }
};
