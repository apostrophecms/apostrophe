<template>
  <div
    class="apos-login__upper"
    v-if="passwordResetEnabled"
  >
    <TheAposLoginHeader
      :env="context.env"
      :title="$t('apostrophe:loginResetPassword')"
      :subtitle="context.name"
      :help="help"
      :error="$t(error)"
    />
    <div class="apos-login__body">
      <AposButton
        v-if="done"
        data-apos-test="loginBack"
        :busy="busy"
        :disabled="disabled"
        type="primary"
        label="apostrophe:loginBack"
        class="apos-login__submit"
        :modifiers="['block']"
        @click="$emit('set-stage', 'login')"
      />
      <form v-else @submit.prevent="submit">
        <AposSchema
          :schema="schema"
          v-model="doc"
        />
        <AposButton
          data-apos-test="pwdResetRequestSubmit"
          :busy="busy"
          :disabled="disabled"
          type="primary"
          label="apostrophe:loginSendEmail"
          button-type="submit"
          class="apos-login__submit"
          :modifiers="['gradient-on-hover', 'block']"
          @click="submit"
        />
      </form>
    </div>
  </div>
</template>

<script>
export default {
  name: 'AposForgotPasswordForm',
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
  emits: [ 'set-stage' ],
  data() {
    return {
      busy: false,
      done: false,
      error: '',
      contextErrorReceived: false,
      doc: {
        data: {},
        hasErrors: false
      },
      schema: [
        {
          name: 'email',
          label: 'apostrophe:email',
          placeholder: 'apostrophe:loginEnterEmail',
          type: 'string',
          required: true
        }
      ]
    };
  },
  computed: {
    disabled() {
      return this.doc.hasErrors;
    },
    passwordResetEnabled() {
      return apos.login.passwordResetEnabled;
    },
    help() {
      if (this.done) {
        return this.$t('apostrophe:loginResetRequestDone', {
          email: this.doc.data.email
        });
      }
      return this.$t('apostrophe:loginResetPasswordRequest');
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
  created() {
    if (!this.passwordResetEnabled) {
      this.$emit('set-stage', 'login');
    }
  },
  mounted() {
    this.error = this.contextError;
    if (this.contextError) {
      this.contextErrorReceived = true;
    }
  },
  methods: {
    async submit() {
      if (this.busy) {
        return;
      }
      this.busy = true;
      this.error = '';

      await this.requestReset();
    },
    async requestReset() {
      try {
        await apos.http.post(`${apos.login.action}/reset-request`, {
          busy: true,
          body: { ...this.doc.data }
        });
        this.done = true;
      } catch (e) {
        this.error = e.message || 'apostrophe:loginErrorGeneric';
      } finally {
        this.busy = false;
      }
    }
  }
};
</script>

<style lang="scss" scoped>
  .apos-login {
    &__message {
      @include type-label;
      text-align: center;
    }
  }

  .apos-login__submit ::v-deep .apos-button {
    height: 47px;
  }
</style>
