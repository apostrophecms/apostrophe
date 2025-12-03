
import { klona } from 'klona';
import AposInputMixin from 'Modules/@apostrophecms/schema/mixins/AposInputMixin.js';
import AposInputFollowingMixin from 'Modules/@apostrophecms/schema/mixins/AposInputFollowingMixin.js';
import AposInputConditionalFieldsMixin from 'Modules/@apostrophecms/schema/mixins/AposInputConditionalFieldsMixin.js';
import { hasParentConditionalField } from 'Modules/@apostrophecms/schema/lib/conditionalFields';

export default {
  name: 'AposInputObject',
  emits: [ 'validate' ],
  mixins: [
    AposInputMixin,
    AposInputFollowingMixin,
    AposInputConditionalFieldsMixin
  ],
  props: {
    generation: {
      type: Number,
      required: false,
      default() {
        return null;
      }
    },
    docId: {
      type: String,
      required: false,
      default() {
        return null;
      }
    }
  },
  data () {
    const next = this.getNext();
    return {
      schemaInput: {
        data: next
      },
      next
    };
  },
  computed: {
    followingValuesWithParent() {
      return this.computeFollowingValues(this.schemaInput.data);
    },
    dataWithfollowingValues() {
      return {
        ...this.computeFollowingValues(this.schemaInput.data, true),
        ...this.values
      };
    },
    shouldResetConditionalFields() {
      return hasParentConditionalField(this.schema);
    },
    // Reqiured for AposInputConditionalFieldsMixin
    schema() {
      return this.field.schema;
    },
    values() {
      return this.schemaInput.data || {};
    },
    objectMeta() {
      const meta = klona(this.fieldMeta);
      const shared = {};

      for (const fieldName of Object.keys(this.meta)) {
        if (fieldName.startsWith('@')) {
          shared[fieldName] = this.meta[fieldName];
        }
      }

      meta.aposMeta = {
        ...(this.fieldMeta.aposMeta || {}),
        ...shared
      };

      return meta;
    },
    currentDocMeta() {
      return this.objectMeta.aposMeta || {};
    },
    currentDocServerErrors() {
      let serverErrors = null;
      (this.serverError?.data?.errors || [])
        .forEach(error => {
          if (error.path) {
            serverErrors = serverErrors || {};
            serverErrors[error.path] = error;
          }
        });
      return serverErrors;
    }
  },
  watch: {
    schemaInput: {
      deep: true,
      handler() {
        if (!this.schemaInput.hasErrors) {
          this.next = this.schemaInput.data;
        }
        // Our validate method was called first before that of
        // the subfields, so remedy that by calling again on any
        // change to the subfield state during validation
        if (this.triggerValidation) {
          this.validateAndEmit();
        }
      }
    },
    followingValues: {
      async handler(values) {
        if (this.shouldResetConditionalFields) {
          this.evaluateConditions(this.dataWithfollowingValues);
        }
      },
      deep: true
    },
    generation() {
      this.next = this.getNext();
      this.schemaInput = {
        data: this.next
      };
    }
  },
  async created() {
    await this.evaluateExternalConditions(this.values);
    this.evaluateConditions(this.dataWithfollowingValues);
  },
  methods: {
    emitValidate() {
      this.$emit('validate');
    },
    validate (value) {
      if (this.schemaInput.hasErrors) {
        return 'invalid';
      }
    },
    // Return next at mount or when generation changes
    getNext() {
      return this.modelValue?.data ? this.modelValue.data : (this.field.def || {});
    }
  }
};
