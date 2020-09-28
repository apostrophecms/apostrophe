<!--
  AposSchema takes an array of fields with their values, renders their inputs, and emits their `input` events
-->
<template>
  <div class="apos-schema">
    <div v-for="field in schema" :key="field.name">
      <component
        v-show="displayComponent(field.name)"
        v-model="fieldState[field.name]"
        :is="fieldComponentMap[field.type]"
        :field="fields[field.name].field"
        :status="fields[field.name].status"
        :modifiers="fields[field.name].modifiers"
        :trigger-validation="triggerValidation"
      />
    </div>
  </div>
</template>

<script>

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
    modifiers: {
      type: Array,
      default() {
        return [];
      }
    },
    triggerValidation: Boolean,
    utilityRail: Boolean
  },
  emits: [ 'input' ],
  data() {
    return {
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
          this.fieldState._id &&
          (newVal.data._id !== this.fieldState._id.data)
        ) {
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
        fieldState[field.name] = {
          error: false,
          data: this.value.data[field.name] || field.def
        };
        next.data[field.name] = fieldState[field.name].data;
      });
      this.next = next;
      this.fieldState = fieldState;
    },
    updateNextAndEmit() {
      this.next.hasErrors = false;
      this.schema.forEach(field => {
        if (this.fieldState[field.name].error) {
          this.next.hasErrors = true;
        }

        if (
          this.fieldState[field.name].data ||
          this.fieldState[field.name].data !== undefined
        ) {
          this.next.data[field.name] = this.fieldState[field.name].data;
        } else {
          this.next.data[field.name] = this.value.data[field.name];
        }
      });
      this.$emit('input', this.next);
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
