<template>
  <div class="apos-schema">
    <fieldset v-for="field in fields">
      <component :is="options.components.fields[field.type]" v-model="next[field.name]" :context="piece" :field="field" />
    </fieldset>
  </div>
</template>

<script>

// A component that accepts a `fields` prop containing an array
// of Apostrophe schema field definitions, allows those fields
// to be edited, and provides two-way data binding with an
// Apostrophe doc object (use `v-model`).
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
    const next = {};
    this.fields.forEach(field => {
      next[field.name] = value[field.name];
    });
    return next;
  },
  watch: {
    // Per rideron89 we must use a "deep" watcher because
    // we are interested in subproperties
    next: {
      deep: true,
      handler(val, oldVal) {
        this.$emit('input', this.next);
      }
    }
  },
  computed: {
    options() {
      return window.apos.modules.schemas;
    }
  }
};
</script>
