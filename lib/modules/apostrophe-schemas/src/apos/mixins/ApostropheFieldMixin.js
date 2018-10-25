module.exports = {
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
    this.validateAndEmit();
  },
  watch: {
    next(value) {
      this.validateAndEmit();
    }
  },
  methods: {
    validateAndEmit() {
      this.$emit('input', {
        data: this.validate(),
        error: this.error
      });
    }
  }
};
