export default {
  props: {
    value: {
      type: Object,
      required: true
    },
    field: {
      type: Object,
      required: true
    },
    status: {
      type: Object,
      default () {
        return {};
      }
    },
    modifiers: {
      default: function () {
        return [];
      },
      type: Array
    },
    followingValue: {
      // Flexible because it depends on the type of the field being
      // followed, if any
      type: [ String, Number, Boolean, Object, Array ],
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
    }
  },
  data () {
    return {
      next: (this.value && this.value.data !== undefined)
        ? this.value.data : (this.field.def || ''),
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
    }
  },
  watch: {
    value: {
      deep: true,
      handler (value) {
        this.watchValue();
      }
    },
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
