<template>
  <div class="apos-schema">
    <component v-for="field in fields" :is="options.components.fields[field.type]" v-model="fieldState[field.name]" :field="field" :context="next.data" />
  </div>
</template>

<script>

// A component that accepts a `fields` prop containing an array
// of Apostrophe schema field definitions, allows those fields
// to be edited, and provides two-way data binding with an
// Apostrophe doc object (use `v-model`). The bound object
// should have two properties, `hasErrors` ( a simple boolean)
// and `data` (the actual apostrophe doc).
//
// This will soon be extended to render and manage groups
// (tabs) while maintaining the same simple interface.

export default {
  name: 'ApostropheSchemaEditor',
  props: {
    value: Object,
    fields: Array
  },
  data() {
    const next = {
      hasErrors: false,
      data: {}
    };
    const fieldState = {};
    this.fields.forEach(field => {
      fieldState[field.name] = {
        error: false,
        data: this.value.data[field.name]
      };
      next.data[field.name] = fieldState[field.name].data;
    });
    if (this.value.data._id) {
      next.data._id = this.value.data._id;
    }
    return {
      next,
      fieldState
    };
  },
  mounted() {
    this.updateNextAndEmit();
  },
  watch: {
    // Per rideron89 we must use a "deep" watcher because
    // we are interested in subproperties
    fieldState: {
      deep: true,
      handler() {
        this.updateNextAndEmit();
      }
    }    
  },
  methods: {
    updateNextAndEmit() {
      this.next.hasErrors = false;
      this.fields.forEach(field => {
        if (this.fieldState[field.name].error) {
          this.next.hasErrors = true;
        }
        this.next.data[field.name] = this.fieldState[field.name].data;
      });
      this.$emit('input', this.next);
    },
  },
  computed: {
    options() {
      return window.apos.schemas;
    }
  }
};

</script>
