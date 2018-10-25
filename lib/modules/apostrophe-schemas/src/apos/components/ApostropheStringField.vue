<template>
  <ApostropheFieldset :field="field" :error="error">
    <template slot="body">
      <input v-model="next" />
    </template>
  </ApostropheFieldset>
</template>

<script>

import ApostropheFieldMixin from './ApostropheFieldMixin.js';

export default {
  mixins: [ ApostropheFieldMixin ],
  name: 'ApostropheStringField',
  methods: {
    validate() {
      this.error = false;
      const value = this.next;
      if (this.field.required) {
        if (!value.length) {
          this.error = 'required';
        }
      }
      if (this.field.min) {
        if (value.length && (value.length < this.field.min)) {
          this.error = 'min';
        }
      }
      if (this.field.max) {
        if (value.length && (value.length > this.field.max)) {
          this.error = 'max';
        }
      }
    }
  }
};
</script>
