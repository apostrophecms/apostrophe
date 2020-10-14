<!--
  AposSchema takes an array of fields with their values, renders their inputs, and emits their `input` events
-->
<template>
  <div class="apos-schema">
    <div
      v-for="field in schema" :key="field.name"
      :data-apos-field="field.name"
    >
      <component
        v-show="displayComponent(field.name)"
        v-model="fieldState[field.name]"
        :following-values="followingValues[field.name]"
        :is="fieldComponentMap[field.type]"
        :field="fields[field.name].field"
        :status="fields[field.name].status"
        :modifiers="fields[field.name].modifiers"
        :trigger-validation="triggerValidation"
        :doc-id="docId"
      />
    </div>
  </div>
</template>

<script>
import { isEqual } from 'lodash';

export default {
  name: 'AposSchema',
  props: {
    value: {
      type: Object,
      required: true
    },
    schema: {
      type: Array,
      required: true
    },
    currentFields: {
      type: Array,
      default() {
        return [];
      }
    },
    followingValues: {
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
    utilityRail: Boolean,
    docId: {
      type: String,
      default() {
        return null;
      }
    }
  },
  emits: [ 'input', 'reset' ],
  data() {
    return {
      schemaReady: false,
      next: {
        hasErrors: false,
        data: {}
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
        // What is this TODO supposed to be? We have error and value already. -Tom
        // TODO populate a dynamic status
        fields[item.name].status = {};

        fields[item.name].modifiers = this.modifiers;
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
    value: {
      deep: true,
      handler(newVal, oldVal) {
        // The doc might be swapped out completely in cases such as the media
        // library editor. Repopulate the fields if that happens.
        if (
          // If the fieldState had been cleared and there's new populated data
          (!this.fieldState._id && newVal.data._id) ||
          // or if there *is* active fieldState, but the new data is a new doc
          (this.fieldState._id && newVal.data._id !== this.fieldState._id.data)
        ) {
          // repopulate the schema.
          this.populateDocData();
        }
      }
    }
  },
  created() {
    this.populateDocData();
  },
  methods: {
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

      this.next.hasErrors = false;
      let changeFound = false;

      this.schema.forEach(field => {
        if (this.fieldState[field.name].error) {
          this.next.hasErrors = true;
        }

        if (
          this.fieldState[field.name].data !== undefined &&
          this.findRealChange(this.next.data[field.name], this.fieldState[field.name].data)
        ) {
          changeFound = true;
          this.next.data[field.name] = this.fieldState[field.name].data;
        } else {
          this.next.data[field.name] = this.value.data[field.name];
        }
      });

      if (changeFound) {
        // ... removes need for deep watch at parent level
        this.$emit('input', { ...this.next });
      }
    },
    findRealChange(oldData, newData) {
      if (isEqual(oldData, newData)) {
        return false;
      } else if (!oldData && !newData) {
        return false;
      } else if (!oldData && Array.isArray(newData) && newData.length === 0) {
        return false;
      } else {
        return true;
      }
    },
    displayComponent(fieldName) {
      return this.currentFields.length ? this.currentFields.includes(fieldName) : true;
    }
  }
};
</script>

<style lang="scss" scoped>
  .apos-field {
    .apos-schema /deep/ & {
      margin-bottom: 30px;
      letter-spacing: 0.5px;
    }

    .apos-schema /deep/ .apos-toolbar & {
      margin-bottom: 0;
    }
  }
</style>
