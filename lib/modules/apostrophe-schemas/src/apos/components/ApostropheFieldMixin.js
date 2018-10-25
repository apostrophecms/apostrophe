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
    this.updateErrorAndEmit();
  },
  watch: {
    next(value) {
      this.updateErrorAndEmit();
    }
  }
};
