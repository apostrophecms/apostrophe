// FIXME move to the Schema module during the next task.
// TODO docs.
// TODO preview mode.
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
    }
  },
  emits: [ 'submit', 'cancel' ],
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
  // If we don't do for this, we get stale values.
  created() {
    this.docFields.data = klona(this.values);
  },
  methods: {
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
      // TODO set preview mode on.
      this.$emit('cancel');
    }
  }
};
