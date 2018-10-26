<template>
  <ApostropheFieldset :field="field" :error="error">
    <template slot="body">
      <input v-model="next" />
    </template>
  </ApostropheFieldset>
</template>

<script>

export default {
  name: 'ApostropheStringField',
  props: {
    value: Object,
    field: Object
  },
  data() {
    return {
      next: (this.value.data !== undefined) ? this.value.data : (this.field.def || ''),
      error: false
    };
  },
  mounted() {
    this.updateErrorAndEmit();
  },
  watch: {
    value: {
      deep: true,
      handler(value) {
        this.next = value.data;
      }
    },
    next(value) {
      this.updateErrorAndEmit();
    }
  },
  methods: {
    updateErrorAndEmit() {
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
      this.$emit('input', {
        data: value,
        error: this.error
      });
    }
  }
};
</script>
