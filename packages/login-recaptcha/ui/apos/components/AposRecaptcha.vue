<script>
export default {
  props: {
    sitekey: {
      type: String,
      default: null
    }
  },
  emits: [ 'done', 'block' ],
  data() {
    return {
      token: null
    };
  },
  computed: {
    recaptchaUrl() {
      return 'https://www.google.com/recaptcha/api.js?render=' + this.sitekey;
    }
  },
  watch: {
    token(newVal) {
      newVal
        ? this.$emit('done', this.token)
        : this.$emit('block');
    }
  },
  mounted() {
    if (!window.grecaptcha) {
      this.addScript();
    }

    this.executeRecaptcha();
  },
  methods: {
    addScript() {
      const scriptElem = document.createElement('script');
      scriptElem.setAttribute('src', this.recaptchaUrl);
      scriptElem.setAttribute('defer', true);

      document.head.appendChild(scriptElem);
    },
    executeRecaptcha() {
      if (!window.grecaptcha) {
        setTimeout(this.executeRecaptcha, 100);
        return;
      }

      window.grecaptcha.ready(async () => {
        this.token = await window.grecaptcha.execute(this.sitekey, { action: 'submit' });
      });
    }
  }
};
</script>

<style scoped></style>
