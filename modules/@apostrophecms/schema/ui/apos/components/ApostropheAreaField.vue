<template>
  <ApostropheFieldset :field="field" :error="error">
    <template slot="body">
      <div ref="areaEditor" class="apos-area" />
    </template>
  </ApostropheFieldset>
</template>

<script>

import ApostropheFieldMixin from '../mixins/ApostropheFieldMixin.js';

export default {
  name: 'ApostropheAreaField',
  mixins: [ ApostropheFieldMixin ],
  mounted() {
    // Intentionally not reactive, a separate vue app will manage it
    const editor = this.$refs.areaEditor;
    editor.setAttribute('data-apos-area-newly-editable', true);
    editor.setAttribute('data-doc-id', this.docId);
    editor.setAttribute('data-field-id', this.field._id);
    editor.setAttribute('data-options', JSON.stringify(this.field.options));
    editor.setAttribute('data-choices', JSON.stringify(this.getChoices()));
    editor.setAttribute('data', JSON.stringify(this.value.data));
    apos.bus.$emit('area-field-rendered');
  },
  methods: {
    getChoices() {
      const result = [];
      for (const [name, options] of Object.entries(this.field.options.widgets)) {
        result.push({
          name,
          label: options.addLabel || apos.modules[`${name}-widget`].label
        });
      }
      return result;
    },
    validate(value) {
      if (this.field.required) {
        if (!value.length) {
          return 'required';
        }
      }
      if (this.field.min) {
        if (value.length && (value.length < this.field.min)) {
          return 'min';
        }
      }
      if (this.field.max) {
        if (value.length && (value.length > this.field.max)) {
          return 'max';
        }
      }
      return false;
    }
  }
};
</script>
