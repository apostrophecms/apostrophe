// Renders a single subform by configuration. Supports preview and edit modes.
// The component is not tied to a specific module and communicates with the
// parent component via events. See the `AposSettingsManager` component for
// an example of how to implement this component.
//
// ## Props
// `values` prop is the current value of the subform, which is an object.
// `subform` prop is the schema for the subform, which is an object.
// `errors` prop is an array or object as expected by the Editor Mixin.
// `busy` prop is a boolean indicating whether the subform (edit mode) is busy.
// `expanded` prop is a boolean indicating whether the subform is in preview (false)
// or edit (true) mode.
// `updateIndicator` prop is a boolean indicating whether the subform should
// display an updated indicator in preview mode.

import { klona } from 'klona';
import AposEditorMixin from 'Modules/@apostrophecms/modal/mixins/AposEditorMixin';

export default {
  name: 'AposSubform',
  mixins: [ AposEditorMixin ],
  props: {
    errors: {
      type: Object,
      default: null
    },
    subform: {
      type: Object,
      required: true
    },
    values: {
      type: Object,
      required: true
    },
    busy: {
      type: Boolean,
      default: false
    },
    expanded: {
      type: Boolean,
      default: true
    },
    updateIndicator: {
      type: Boolean,
      default: false
    },
    separator: {
      type: Boolean,
      default: false
    }
  },
  emits: [ 'submit', 'cancel', 'update-expanded' ],
  data() {
    return {
      docFields: {
        data: {},
        hasErrors: false
      },
      triggerValidation: false,
      triggerHover: false,
      scrollTimeout: null
    };
  },

  computed: {
    schema() {
      return (this.subform.schema ?? []);
    },
    serverError() {
      return this.error || !!this.serverErrors;
    }
  },

  watch: {
    values(newValues) {
      this.docFields.data = klona(newValues);
    },
    errors(newErrors) {
      this.serverErrors = newErrors;
    },
    expanded(newExpanded) {
      this.triggerHover = false;
      if (newExpanded) {
        setTimeout(() => {
          this.scrollIntoView();
        }, 350);
      }
    }
  },
  // If we don't do this, we get stale initial values.
  async mounted() {
    await this.evaluateExternalConditions();
    this.evaluateConditions();
    this.docFields.data = klona(this.values);
  },
  beforeUnmount() {
    clearTimeout(this.scrollTimeout);
  },
  methods: {
    scrollIntoView() {
      this.$el.scrollIntoView();
    },
    toggleExpanded() {
      this.$emit('update-expanded', {
        name: this.subform.name,
        value: !this.expanded
      });
    },
    updateDocFields(value) {
      this.docFields = value;
      this.evaluateConditions();
    },
    async submit() {
      this.triggerValidation = true;
      this.$nextTick(async () => {
        if (this.docFields.hasErrors) {
          this.triggerValidation = false;
          return;
        }
        this.$emit('submit', {
          name: this.subform.name,
          values: this.docFields.data
        });
      });
    },
    async cancel() {
      this.$emit('cancel', {
        name: this.subform.name
      });
      this.toggleExpanded();
      // Security: we don't want to leave any passwords in the DOM
      this.$nextTick(() => {
        this.clearPasswords();
      });
    },
    clearPasswords() {
      this.subform.schema
        .filter(field => field.type === 'password')
        .forEach(field => {
          this.docFields.data[field.name] = '';
        });
    }
  }
};
