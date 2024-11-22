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
  emits: [ 'replace-field-value' ],
  props: {
    field: {
      type: Object,
      required: true
    },
    meta: {
      type: Object,
      default() {
        return {};
      }
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
    },
    // Meta components receive the original data (key `_original`) and
    // the "pure" keys (no namespace prefix) and values from their namespace.
    // The `_original` key is useful for analyzing e.g. `area`, `array`, etc fields
    // inside the metadata components.
    // All registered metadata components will be rendered. It's the external
    // component responsibility to not render itself when no matching conditions
    // from its namespace are met.
    metaComponents() {
      const meta = {};
      for (const metaKey of Object.keys(this.meta)) {
        const [ ns, key ] = metaKey.split(':', 2);
        if (!key) {
          continue;
        }
        if (!meta[ns]) {
          meta[ns] = {};
        }
        meta[ns][key] = this.meta[metaKey];
      }

      return apos.schema.fieldMetadataComponents
        .map(({ name, namespace }) => {
          return {
            name,
            namespace,
            data: meta[namespace] || {}
          };
        });
    }
  },
  mounted: function () {
    if (this.field.type === 'radio' || this.field.type === 'checkbox') {
      this.wrapEl = 'fieldset';
      this.labelEl = 'legend';
    }
  },
  methods: {
    // Notify about a value, suggested by meta components or their children.
    replaceFieldValue(value) {
      this.$emit('replace-field-value', value);
    }
  }
};
