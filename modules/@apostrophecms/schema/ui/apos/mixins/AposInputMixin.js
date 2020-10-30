export default {
  // Implements v-model pattern
  emits: [ 'input' ],
  props: {
    // The value passed in from the parent component through the v-model
    // directive.
    value: {
      type: Object,
      required: true
    },
    field: {
      type: Object,
      required: true
    },
    modifiers: {
      default: function () {
        return [];
      },
      type: Array
    },
    followingValues: {
      type: Object,
      required: false
    },
    triggerValidation: {
      type: Boolean,
      default: false
    },
    // Because some field types, like AposInputSlug, must check for
    // uniqueness without regarding the document itself as a conflict
    docId: {
      type: String,
      required: false
    },
    // An error for this field that was provided by the server on
    // an attempt to save the larger document
    serverError: {
      type: Object,
      required: false
    }
  },
  data () {
    return {
      next: (this.value && this.value.data !== undefined)
        ? this.value.data : '',
      error: false,
      // This is just meant to be sufficient to prevent unintended collisions
      // in the UI between id attributes
      uid: Math.random(),
      // Automatically updated for you, can be watched
      focus: false
    };
  },
  mounted () {
    this.$el.addEventListener('focusin', this.focusInListener);
    this.$el.addEventListener('focusout', this.focusOutListener);
  },
  destroyed () {
    this.$el.removeEventListener('focusin', this.focusInListener);
    this.$el.removeEventListener('focusout', this.focusOutListener);
  },
  computed: {
    options () {
      return window.apos.schema;
    },
    iconSize () {
      if (this.modifiers.includes('small')) {
        return 14;
      } else {
        return 20;
      }
    },
    effectiveError () {
      return this.error || this.serverError;
    }
  },
  watch: {
    value: {
      deep: true,
      handler (value) {
        this.watchValue();
      }
    },
    // `next` is the internal state of the input's value, which is eventually
    // emitted with the 'input' event.
    next: {
      deep: true,
      handler (value) {
        this.watchNext();
      }
    },
    triggerValidation(value) {
      if (value) {
        this.validateAndEmit();
      }
    },
    focus(value) {
      if (!value) {
        this.validateAndEmit();
      }
    }
  },
  methods: {
    validateAndEmit () {
      this.$emit('input', {
        data: this.next,
        error: this.validate(this.next)
      });
    },
    watchValue () {
      this.error = this.value.error;
      this.next = this.value.data;
    },
    watchNext () {
      this.validateAndEmit();
    },
    focusInListener() {
      this.focus = true;
    },
    focusOutListener() {
      this.focus = false;
    }
  }
};
