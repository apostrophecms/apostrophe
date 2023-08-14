import { detectFieldChange } from 'Modules/@apostrophecms/schema/lib/detectChange';

export default {
  name: 'AposSchema',
  props: {
    value: {
      type: Object,
      required: true
    },
    generation: {
      type: Number,
      required: false,
      default() {
        return null;
      }
    },
    schema: {
      type: Array,
      required: true
    },
    fieldStyle: {
      type: String,
      required: false,
      default: ''
    },
    currentFields: {
      type: Array,
      default() {
        return null;
      }
    },
    followingValues: {
      type: Object,
      default() {
        return {};
      }
    },
    conditionalFields: {
      type: Object,
      default() {
        return {};
      }
    },
    modifiers: {
      type: Array,
      default() {
        return [];
      }
    },
    triggerValidation: Boolean,
    utilityRail: {
      type: Boolean,
      default() {
        return false;
      }
    },
    docId: {
      type: String,
      default() {
        return null;
      }
    },
    serverErrors: {
      type: Object,
      default() {
        return null;
      }
    },
    displayOptions: {
      type: Object,
      default() {
        return {};
      }
    },
    changed: {
      type: Array,
      default() {
        return [];
      }
    }
  },
  emits: [
    'input',
    'reset',
    'validate',
    'update-doc-data'
  ],
  data() {
    return {
      schemaReady: false,
      next: {
        hasErrors: false,
        data: {},
        fieldErrors: {}
      },
      fieldState: {},
      fieldComponentMap: window.apos.schema.components.fields || {}
    };
  },
  computed: {
    fields() {
      const fields = {};
      this.schema.forEach(item => {
        fields[item.name] = {};
        fields[item.name].field = item;
        fields[item.name].value = {
          data: this.value[item.name]
        };
        fields[item.name].serverError = this.serverErrors && this.serverErrors[item.name];
        fields[item.name].modifiers = [
          ...(this.modifiers || []),
          ...(item.modifiers || [])
        ];
      });
      return fields;
    }
  },
  watch: {
    fieldState: {
      deep: true,
      handler() {
        this.updateNextAndEmit();
      }
    },
    schema() {
      this.populateDocData();
    },
    'value.data._id'(_id) {
      // The doc might be swapped out completely in cases such as the media
      // library editor. Repopulate the fields if that happens.
      if (
        // If the fieldState had been cleared and there's new populated data
        (!this.fieldState._id && _id) ||
        // or if there *is* active fieldState, but the new data is a new doc
        (this.fieldState._id && _id !== this.fieldState._id.data)
      ) {
        // repopulate the schema.
        this.populateDocData();
      }
    },
    generation() {
      // repopulate the schema.
      this.populateDocData();
    },
    conditionalFields(newVal, oldVal) {
      for (const field in oldVal) {
        if (!this.fieldState[field] || (newVal[field] === oldVal[field]) || !this.fieldState[field].ranValidation) {
          continue;
        }

        if (
          (newVal[field] === false) ||
          (newVal[field] && this.fieldState[field].ranValidation)
        ) {
          this.$emit('validate');
        }
      }
    }
  },
  created() {
    this.populateDocData();
  },
  methods: {
    getDisplayOptions(fieldName) {
      let options = {};
      if (this.displayOptions) {
        options = { ...this.displayOptions };
      }
      if (this.changed && this.changed.includes(fieldName)) {
        options.changed = true;
      }
      return options;
    },
    populateDocData() {
      this.schemaReady = false;
      const next = {
        hasErrors: false,
        data: {}
      };

      const fieldState = {};

      // Though not in the schema, keep track of the _id field.
      if (this.value.data._id) {
        next.data._id = this.value.data._id;
        fieldState._id = { data: this.value.data._id };
      }
      // Though not *always* in the schema, keep track of the archived status.
      if (this.value.data.archived !== undefined) {
        next.data.archived = this.value.data.archived;
        fieldState.archived = { data: this.value.data.archived };
      }

      this.schema.forEach(field => {
        const value = this.value.data[field.name];
        fieldState[field.name] = {
          error: false,
          data: (value === undefined) ? field.def : value
        };
        next.data[field.name] = fieldState[field.name].data;
      });
      this.next = next;
      this.fieldState = fieldState;

      // Wait until the next tick so the parent editor component is done
      // updating. This is only really a concern in editors that can swap
      // the active doc/object without unmounting AposSchema.
      this.$nextTick(() => {
        this.schemaReady = true;
        // Signal that the schema data is ready to be tracked.
        this.$emit('reset');
      });
    },
    updateNextAndEmit() {
      if (!this.schemaReady) {
        return;
      }
      const oldHasErrors = this.next.hasErrors;
      // destructure these for non-linked comparison
      const oldFieldState = { ...this.next.fieldState };
      const newFieldState = { ...this.fieldState };

      let changeFound = false;

      this.next.hasErrors = false;
      this.next.fieldState = { ...this.fieldState };

      this.schema.filter(field => this.displayComponent(field)).forEach(field => {
        if (this.fieldState[field.name].error) {
          this.next.hasErrors = true;
        }
        if (
          this.fieldState[field.name].data !== undefined &&
          detectFieldChange(field, this.next.data[field.name], this.fieldState[field.name].data)
        ) {
          changeFound = true;
          this.next.data[field.name] = this.fieldState[field.name].data;
        } else {
          this.next.data[field.name] = this.value.data[field.name];
        }
      });
      if (
        oldHasErrors !== this.next.hasErrors ||
        oldFieldState !== newFieldState
      ) {
        // Otherwise the save button may never unlock
        changeFound = true;
      }

      if (changeFound) {
        // ... removes need for deep watch at parent level
        this.$emit('input', { ...this.next });
      }
    },
    displayComponent({ name, hidden = false }) {
      if (hidden === true) {
        return false;
      }

      if (this.currentFields && !this.currentFields.includes(name)) {
        return false;
      }

      // Might not be a conditional field at all, so test explicitly for false
      if (this.conditionalFields[name] === false) {
        return false;
      }

      return true;
    },
    scrollFieldIntoView(fieldName) {
      // The refs for a name are an array if that ref was assigned
      // in a v-for. We know there is only one in this case
      // https://forum.vuejs.org/t/this-refs-theid-returns-an-array/31995/9
      this.$refs[fieldName][0].$el.scrollIntoView();
    },
    onUpdateDocData(data) {
      this.$emit('update-doc-data', data);
    }
  }
};
