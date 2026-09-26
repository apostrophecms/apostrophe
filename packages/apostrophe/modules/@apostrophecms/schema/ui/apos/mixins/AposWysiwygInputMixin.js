// Everything an on-page field editor has in common, whatever the field type.
// Mix this into any `AposWysiwygInput*` component, i.e. the components mounted
// by `AposWysiwygFields` for the `{% field %}` custom tag.
//
// The save semantics are those of `AposAreaEditor`: when the field belongs to
// the document being edited on this page, changes are patched through the
// context bar, which debounces and serializes them. Otherwise the change is
// emitted for a parent component to deal with, so that these editors can also
// be used inside a modal.

import { withoutSaving } from 'Modules/@apostrophecms/admin-bar/lib/history.js';
import { useCollabStore } from 'Modules/@apostrophecms/collab/stores/collab.js';

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
  // The document to patch as the field is edited. Null in a modal, which
  // saves its own copy of the value rather than patching anything: see
  // `AposWysiwygFields`
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
      // What the server has, as far as we know. It is what undoing our next
      // save puts back
      lastSaved: this.modelValue,
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
  created() {
    // Set when several people may be editing the document at once. The text
    // is then saved as it is typed by the collaboration session, not by
    // patching the whole value, see `save`
    const session = useCollabStore().session;
    this.collabSession = (this.onPage && session && (session.docId === this.docId))
      ? session
      : null;
  },
  watch: {
    modelValue(value) {
      if (value !== this.next) {
        this.next = value;
      }
    }
  },
  mounted() {
    apos.bus.$on('context-history-apply', this.contextHistoryApplyHandler);
  },
  beforeUnmount() {
    this.flush();
    apos.bus.$off('context-history-apply', this.contextHistoryApplyHandler);
  },
  methods: {
    // Put the cursor in this field, because the user asked to edit it, e.g.
    // by clicking the last crumb of its trail. Only the editor knows what its
    // own markup looks like, so `AposWysiwygField` asks rather than guessing.
    //
    // The default handles an ordinary form control or a rich text editing
    // area, whether it is this component's own root element or nested inside
    // it. An editor that is none of those things overrides this method
    focus() {
      const el = this.$el;
      if (el?.nodeType !== Node.ELEMENT_NODE) {
        return;
      }
      const selector = 'textarea, input, select, [contenteditable="true"]';
      const focusable = el.matches(selector) ? el : el.querySelector(selector);
      focusable?.focus();
    },
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
        const report = () => apos.bus.$emit('context-edited', {
          patch: {
            [this.patchKey]: this.next
          },
          inverse: {
            [this.patchKey]: this.lastSaved
          },
          target: {
            kind: 'field',
            docId: this.docId,
            patchKey: this.patchKey
          }
        });
        if (this.collabSession) {
          // Saved as it was typed
          withoutSaving(report);
        } else {
          report();
        }
        this.lastSaved = this.next;
        // The document on the server is not the only thing holding this
        // value. Every area editor on the page keeps its own copy of the
        // widget the field belongs to, and that copy is what copying,
        // cutting, duplicating or opening the widget's editor works from, so
        // it has to hear about this as well
        apos.bus.$emit('field-edited', {
          docId: this.docId,
          patchKey: this.patchKey,
          value: this.next
        });
      }
      // The document on the server is not the only thing holding this value,
      // and in a modal it is not holding it at all. Every area editor keeps
      // its own copy of the widget the field belongs to, and that copy is
      // what copying, cutting, duplicating and opening the widget's editor
      // work from — and, in a modal, what is saved when the user says so. It
      // has to hear about this either way
      apos.bus.$emit('field-edited', {
        docId: this.docId,
        patchKey: this.patchKey,
        value: this.next
      });
      // For a parent component that manages the value itself, as
      // `AposInputArea` does for an area editor in a modal
      this.$emit('update:modelValue', this.next);
      this.$emit('changed', this.next);
    },
    // The context bar is undoing or redoing an edit. If it is one of ours,
    // show the value it put back. The server hears about it from the context
    // bar, but the area editors holding a copy of our widget hear it from us,
    // just as they do when the user types
    contextHistoryApplyHandler(event) {
      if (!this.onPage || !Object.hasOwn(event.patch, this.patchKey)) {
        return;
      }
      if (this.collabSession) {
        // Someone replaced the value some other way, and the collaboration
        // session hears about it too, in step with everything else typed
        // here. Showing it now could mix the two up
        event.claim();
        return;
      }
      if (this.pending) {
        clearTimeout(this.pending);
        this.pending = null;
      }
      const value = event.patch[this.patchKey];
      this.next = value;
      this.lastSaved = value;
      apos.bus.$emit('field-edited', {
        docId: this.docId,
        patchKey: this.patchKey,
        value
      });
      event.claim();
    }
  }
};
