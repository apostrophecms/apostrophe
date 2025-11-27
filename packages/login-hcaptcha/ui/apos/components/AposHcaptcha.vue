<template>
  <div
    class="h-captcha"
    :data-sitekey="sitekey"
  >
  </div>
</template>

<script>
export default {
  emits: [ 'done', 'block' ],
  props: {
    sitekey: String,
    url: {
      type: String,
      default: 'https://js.hcaptcha.com/1/api.js?render=explicit'
    }
  },
  data() {
    return {
      token: null,
      hcaptcha: null
    };
  },
  mounted() {
    if (!window.hcaptcha) {
      this.addScript();
    }

    this.executeHcaptcha();
  },
  watch: {
    token(newVal) {
      if (newVal) {
        this.$emit('done', this.token);
      } else {
        this.$emit('block');
      }
    }
  },
  methods: {
    addScript() {
      let scriptElem = document.createElement('script');
      scriptElem.setAttribute('src', this.url);
      scriptElem.setAttribute('async', true);
      scriptElem.setAttribute('defer', true);

      document.head.appendChild(scriptElem);
    },
    verify(token) {
      this.token = token;
    },
    reset() {
      this.token = null;
    },
    executeHcaptcha() {
      if (!window.hcaptcha) {
        setTimeout(this.executeHcaptcha, 100);
        return;
      }

      this.hcaptcha = window.hcaptcha;

      const options = {
        sitekey: this.sitekey,
        callback: this.verify,
        'expired-callback': this.reset,
        'error-callback': this.reset
      };
      this.hcaptcha.render(this.$el, options);
    }
  }
};
</script>

<style scoped>
</style>
