module.exports = {
  props: {
    value: Object,
    field: Object,
    context: Object
  },
  data() {
    return {
      next: (this.value.data !== undefined) ? this.value.data : (this.field.def || ''),
      error: false,
      // This is just meant to be sufficient to prevent unintended collisions
      // in the UI between id attributes
      uid: Math.random()
    };
  },
  mounted() {
    this.validateAndEmit();
  },
  computed: {
    options() {
      return window.apos.schema;
    }
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
      this.error = this.value.error;
      this.next = this.value.data;
    },
    watchNext() {
      this.validateAndEmit();
    }
  }
};
