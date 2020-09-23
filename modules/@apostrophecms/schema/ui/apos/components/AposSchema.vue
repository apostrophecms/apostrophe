<!--
  AposSchema takes an array of fields with their values, renders their inputs, and emits their `input` events
-->
<template>
  <div class="apos-schema">
    <div v-for="field in currentSchema" :key="field.name">
      <component
        v-if="fieldState[field.name]"
        v-model="fieldState[field.name]"
        :is="fieldComponentMap[field.type]"
        :field="fields[field.name].field"
        :status="fields[field.name].status"
        :modifiers="fields[field.name].modifiers"
        :doc-id="fieldState._id && fieldState._id.data"
        :follows-value="fields[field.name].field.follows && value.data[fields[field.name].field.follows]"
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
    }
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
    currentSchema: function() {
      if (this.currentFields.length === 0) {
        return this.schema;
      }

      const fields = [];
      this.currentFields.forEach((field) => {
        fields.push(this.schema.find(item => {
          return field === item.name;
        }));
      });

      return fields;
    },
    fields() {
      const fields = {};
      this.currentSchema.forEach((item) => {
        fields[item.name] = {};
        fields[item.name].field = { ...item };
        fields[item.name].value = {
          data: this.value[item.name]
        };
        // What is this TODO supposed to be? We have error and value already. -Tom
        // TODO populate a dynamic status
        fields[item.name].status = {};

        fields[item.name].modifiers = this.modifiers;

        // final difference smoothing
        if (item.type === 'string') {
          fields[item.name].field.type = 'text';
        }
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
  mounted() {
    this.populateDocData();
    this.$store.commit('setDoc', this.next.data);
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
