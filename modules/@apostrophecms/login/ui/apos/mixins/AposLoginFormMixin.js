// Mixin for login form related common behavior.

export default {
  props: {
    contextError: {
      type: String,
      default: ''
    },
    context: {
      type: Object,
      default: function() {
        return {};
      }
    }
  },
  data() {
    return {
      error: '',
      doc: {
        data: {},
        hasErrors: false
      }
    };
  },
  computed: {
    passwordResetEnabled() {
      return apos.login.passwordResetEnabled;
    }
  },
  watch: {
    contextError(newVal) {
      // Copy it only once
      if (!this.contextErrorReceived && newVal && !this.error) {
        this.error = newVal;
        this.contextErrorReceived = true;
      }
    }
  },
  mounted() {
    this.error = this.contextError;
    if (this.contextError) {
      this.contextErrorReceived = true;
    }
  }
};
