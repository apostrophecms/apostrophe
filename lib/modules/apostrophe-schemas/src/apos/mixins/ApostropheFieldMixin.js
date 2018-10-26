module.exports = {
  props: {
    value: Object,
    field: Object,
    context: Object
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
    value: {
      deep: true,
      handler(value) {
        this.watchValue();
      }
    },
    next(value) {
      this.watchNext();
    }
  },
  methods: {
    validateAndEmit() {
      this.$emit('input', {
        data: this.next,
        error: this.validate(this.next)
      });
    },
    watchValue() {
      this.next = this.value.data;
    },
    watchNext() {
      this.validateAndEmit();
    }
  }
};
