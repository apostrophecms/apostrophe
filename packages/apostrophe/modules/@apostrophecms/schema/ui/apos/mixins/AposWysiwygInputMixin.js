// Everything an on-page field editor has in common, whatever the field type.
// Mix this into any `AposWysiwygInput*` component, i.e. the components mounted
// by `AposWysiwygFields` for the `{% field %}` custom tag.
//
// The save semantics are those of `AposAreaEditor`: when the field belongs to
// the document being edited on this page, changes are patched through the
// context bar, which debounces and serializes them. Otherwise the change is
// emitted for a parent component to deal with, so that these editors can also
// be used inside a modal.

// Everything the editor of a field edited in place is told about it.
// `AposWysiwygField` accepts these too, and passes them straight through
export const wysiwygProps = {
  // The schema field definition, as the server composed it
  field: {
    type: Object,
    required: true
  },
  // The stored value, not a rendering of it
  modelValue: {
    type: null,
    default: null
  },
  // The document the field belongs to, if any
  docId: {
    type: String,
    default: null
  },
  // Where the value lives in that document: `fieldName` for a field of the
  // document itself, `@widgetId.fieldName` for a field of a widget, an
  // array item or an object nested in it
  patchKey: {
    type: String,
    default: null
  },
  // Options passed to the `{% field %}` tag with the `with` keyword
  options: {
    type: Object,
    default() {
      return {};
    }
  }
};

export default {
  props: wysiwygProps,
  emits: [ 'update:modelValue', 'changed' ],
  data() {
    return {
      next: this.modelValue,
      pending: null
    };
  },
  computed: {
    // True when this field belongs to the document being edited on this page,
    // which is what makes patching it possible
    onPage() {
      return !!(this.docId && (this.docId === window.apos.adminBar.contextId));
    },
    readOnly() {
      return !!this.field.readOnly;
    },
    placeholder() {
      return this.$t(this.field.placeholder || this.field.label || '');
    }
  },
  watch: {
    modelValue(value) {
      if (value !== this.next) {
        this.next = value;
      }
    }
  },
  beforeUnmount() {
    this.flush();
  },
  methods: {
    // Accept a new value and save it right away. For editors that debounce
    // on their own, such as rich text
    update(value) {
      if (this.readOnly || (value === this.next)) {
        return;
      }
      this.next = value;
      this.save();
    },
    // Accept a new value, hint that the user is typing, and save in a moment.
    // For editors that do not debounce on their own
    updateDebounced(value) {
      if (this.readOnly || (value === this.next)) {
        return;
      }
      this.next = value;
      if (this.onPage) {
        apos.bus.$emit('context-editing');
      }
      if (this.pending) {
        // Don't reset the timeout; we still want to save at least once per
        // second while the user is actively typing
        return;
      }
      this.pending = setTimeout(() => {
        this.save();
      }, 1000);
    },
    // Save a debounced change immediately, e.g. because focus was lost
    flush() {
      if (this.pending) {
        this.save();
      }
    },
    save() {
      if (this.pending) {
        clearTimeout(this.pending);
        this.pending = null;
      }
      if (this.onPage) {
        apos.bus.$emit('context-edited', {
          [this.patchKey]: this.next
        });
      }
      // For a parent component that manages the value itself, as
      // `AposInputArea` does for an area editor in a modal
      this.$emit('update:modelValue', this.next);
      this.$emit('changed', this.next);
    }
  }
};
