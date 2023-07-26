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
    preview: {
      type: Boolean,
      default: true
    },
    updateIndicator: {
      type: Boolean,
      default: false
    }
  },
  emits: [ 'submit', 'cancel', 'update-preview' ],
  data() {
    return {
      docFields: {
        data: {},
        hasErrors: false
      },
      triggerValidation: false
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
    }
  },
  // If we don't do this, we get stale initial values.
  created() {
    this.docFields.data = klona(this.values);
  },
  methods: {
    togglePreview() {
      this.$emit('update-preview', !this.preview);
    },
    updateDocFields(value) {
      this.docFields = value;
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
      this.$emit('cancel');
      this.togglePreview();
    }
  }
};
