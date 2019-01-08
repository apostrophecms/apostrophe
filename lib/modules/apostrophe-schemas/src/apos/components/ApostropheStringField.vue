<template>
  <ApostropheFieldset :field="field" :error="error">
    <template slot="body">
      <input v-model="next" />
    </template>
  </ApostropheFieldset>
</template>

<script>

export default {
  mixins: [ apos.mixins.ApostropheFieldMixin ],
  name: 'ApostropheStringField',
  methods: {
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
