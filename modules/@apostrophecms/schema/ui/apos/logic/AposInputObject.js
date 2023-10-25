
import AposInputMixin from 'Modules/@apostrophecms/schema/mixins/AposInputMixin.js';
import AposInputFollowingMixin from 'Modules/@apostrophecms/schema/mixins/AposInputFollowingMixin.js';
import AposInputConditionalFieldsMixin from 'Modules/@apostrophecms/schema/mixins/AposInputConditionalFieldsMixin.js';
import { getConditionTypesObject } from 'Modules/@apostrophecms/schema/lib/conditionalFields';

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
      next,
      conditionalFields: getConditionTypesObject()
    };
  },
  computed: {
    followingValuesWithParent() {
      return this.computeFollowingValues(this.schemaInput.data);
    },
    // Reqiured for AposInputConditionalFieldsMixin
    schema() {
      return this.field.schema;
    },
    values() {
      return this.schemaInput.data || {};
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
    generation() {
      this.next = this.getNext();
      this.schemaInput = {
        data: this.next
      };
    }
  },
  async created() {
    this.conditionalFields = this.getConditionalFields(this.values);
    await this.evaluateExternalConditions(this.values);
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
      return this.value?.data ? this.value.data : (this.field.def || {});
    },

    evaluateConditionalFields() {
      for (const [ conditionType, fields ] of Object.entries(this.getConditionalFields(this.values))) {
        for (const [ field, val ] of Object.entries(fields)) {
          this.$set(this.conditionalFields[conditionType], field, val);
        }
      }
    }
  }
};
