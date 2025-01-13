import { klona } from 'klona';

export default {
  // Implements v-model pattern
  emits: [ 'update:modelValue' ],
  props: {
    // The value passed in from the parent component through the v-model
    // directive.
    modelValue: {
      type: Object,
      required: true
    },
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
    modifiers: {
      default: function () {
        return [];
      },
      type: Array
    },
    followingValues: {
      type: Object,
      required: false
    },
    conditionMet: {
      type: Boolean,
      required: false
    },
    triggerValidation: {
      type: Boolean,
      default: false
    },
    displayOptions: {
      type: Object,
      default() {
        return {};
      }
    },
    // Because some field types, like AposInputSlug, must check for
    // uniqueness without regarding the document itself as a conflict
    docId: {
      type: String,
      required: false
    },
    // An error for this field that was provided by the server on
    // an attempt to save the larger document
    serverError: {
      type: Object,
      required: false
    },

    noBlurEmit: {
      type: Boolean,
      default: false
    }
  },
  data () {
    return {
      next: (this.modelValue && this.modelValue.data !== undefined) ? this.modelValue.data : '',
      error: false,
      // This is just meant to be sufficient to prevent unintended collisions
      // in the UI between id attributes
      uid: Math.random(),
      // Automatically updated for you, can be watched
      focus: false,
      // Can be overriden at input component level to handle async field preparation
      fieldReady: true
    };
  },
  mounted () {
    this.$el.addEventListener('focusin', this.focusInListener);
    this.$el.addEventListener('focusout', this.focusOutListener);
  },
  unmounted () {
    this.$el.removeEventListener('focusin', this.focusInListener);
    this.$el.removeEventListener('focusout', this.focusOutListener);
  },
  computed: {
    options () {
      return window.apos.schema;
    },
    iconSize () {
      if (this.modifiers.includes('small')) {
        return 14;
      } else {
        return 20;
      }
    },
    tooltip () {
      let msg = false;
      if (this.field.readOnly) {
        msg = 'apostrophe:inputFieldIsDisabled';
      }
      return msg;
    },
    effectiveError () {
      return this.error || this.serverError;
    },
    fieldMeta() {
      return this.meta?.[this.field.name] || {};
    }
  },
  watch: {
    modelValue: {
      deep: true,
      handler (value) {
        this.watchValue();
      }
    },
    // `next` is the internal state of the input's value, which is eventually
    // emitted with the 'input' event.
    next: {
      deep: true,
      handler (value) {
        this.watchNext();
      }
    },
    triggerValidation(value) {
      if (value) {
        this.validateAndEmit();
      }
    },
    focus(value) {
      if (!this.noBlurEmit && !value) {
        this.validateAndEmit();
      }
    }
  },
  methods: {
    // You must supply the validate method. It receives the
    // internal representation used for editing (a string, for instance)
    validateAndEmit () {
      if (!this.fieldReady) {
        return;
      }
      // If the field is conditional and isn't shown, disregard any errors.
      // If field isn't ready we don't want to validate its value
      const shouldValidate = this.conditionMet !== false;
      const error = shouldValidate
        ? this.validate(this.next)
        : false;

      this.$emit('update:modelValue', {
        data: error ? this.next : this.convert(this.next),
        error,
        ranValidation: shouldValidate ? true : this.modelValue.ranValidation
      });
    },
    // Allows replacing the current component value externally, e.g. via
    // local component or global bus events.
    replaceFieldValue(value) {
      this.next = value;
    },
    watchValue () {
      this.error = this.modelValue.error;
      this.next = this.modelValue.data;
    },
    watchNext () {
      this.validateAndEmit();
    },
    focusInListener() {
      this.focus = true;
    },
    focusOutListener() {
      this.focus = false;
    },
    // Convert from the representation used for editing
    // (for instance, a string) to the final representation
    // required by the field type (for instance, a number).
    // Called just before the input event is emitted. Not
    // called if validation, which is done on the editing
    // representation, is unsuccessful. Instead the editing
    // representation is emitted to preserve the editing
    // experience.
    convert() {
      return this.next;
    },
    // Accepts an array of object values and convertts the current meta to items
    // so that it contains only the item _id's as keys (without leading `@`) and
    // meta keys for the current field if any.
    // This util is meant to be used in array and widget wrappers or
    // custom fields that manage array of object values having unique `_id`.
    convertMetaToItems(valueItems = []) {
      const fieldMeta = klona(this.fieldMeta);
      const meta = this.meta || {};

      const shared = {};
      for (const fieldName of Object.keys(meta)) {
        if (fieldName.startsWith('@') && !valueItems.some(item => meta[`@${item._id}`])) {
          shared[fieldName] = meta[fieldName];
          continue;
        }
      }
      for (const item of valueItems) {
        const itemMeta = meta[`@${item._id}`] || {};
        const subMeta = itemMeta.aposMeta;
        fieldMeta[item._id] = {
          ...itemMeta,
          aposMeta: {
            ...(subMeta || {}),
            ...shared
          }
        };
      }

      return fieldMeta;
    }
  }
};
