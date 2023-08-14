// A component designed to be used as a scaffold for AposInputString and
// friends, which override the `body` slot
export default {
  name: 'AposInputWrapper',
  inject: {
    originalDoc: {
      default: () => ({
        ref: null
      })
    }
  },
  props: {
    field: {
      type: Object,
      required: true
    },
    error: {
      type: [ String, Boolean, Object ],
      default: null
    },
    uid: {
      type: Number,
      required: true
    },
    modifiers: {
      type: Array,
      default() {
        return [];
      }
    },
    items: {
      type: Array,
      default() {
        return [];
      }
    },
    displayOptions: {
      type: Object,
      default() {
        return {};
      }
    }
  },
  data () {
    return {
      wrapEl: 'div',
      labelEl: 'label'
    };
  },
  computed: {
    label () {
      const { label, publishedLabel } = this.field;

      if (
        this.originalDoc.ref &&
        this.originalDoc.ref.lastPublishedAt &&
        publishedLabel
      ) {
        return publishedLabel;
      }

      return label;
    },
    classList: function () {
      const classes = [
        'apos-field',
        `apos-field--${this.field.type}`,
        `apos-field--${this.field.name}`
      ];
      if (this.field.classes) {
        classes.push(this.field.classes);
      }
      if (this.errorClasses) {
        classes.push(this.errorClasses);
      }
      if (this.modifiers) {
        this.modifiers.forEach((m) => {
          classes.push(`apos-field--${m}`);
        });
      }
      return classes;
    },
    errorClasses: function () {
      if (!this.error) {
        return null;
      }

      let error = 'unknown';

      if (typeof this.error === 'string') {
        error = this.error;
      } else if (this.error.name) {
        error = this.error.name;
      }

      return `apos-field--error apos-field--error-${error}`;
    },
    errorMessage () {
      if (this.error) {
        if (typeof this.error === 'string') {
          return this.error;
        } else if (this.error.message) {
          return this.error.message;
        } else {
          return 'Error';
        }
      } else {
        return false;
      }
    }
  },
  mounted: function () {
    if (this.field.type === 'radio' || this.field.type === 'checkbox') {
      this.wrapEl = 'fieldset';
      this.labelEl = 'legend';
    }
  }
};
