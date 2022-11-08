<template>
  <div
    class="apos-login-form"
    v-if="passwordResetEnabled"
  >
    <TheAposLoginHeader
      :env="context.env"
      :title="$t('apostrophe:loginResetPassword')"
      :subtitle="context.name"
      :help="help"
      :error="$t(error)"
    />
    <div class="apos-login-form__body" data-apos-test="pwdResetRequestForm">
      <AposButton
        v-if="done"
        data-apos-test="loginBack"
        :busy="busy"
        type="primary"
        label="apostrophe:loginBack"
        class="apos-login-form__submit"
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
          class="apos-login-form__submit"
          :modifiers="['gradient-on-hover', 'block']"
          @click="submit"
        />
      </form>
    </div>
  </div>
</template>

<script>
import AposLoginFormMixin from 'Modules/@apostrophecms/login/mixins/AposLoginFormMixin';

export default {
  name: 'AposForgotPasswordForm',
  mixins: [ AposLoginFormMixin ],
  emits: [ 'set-stage' ],
  data() {
    return {
      busy: false,
      done: false,
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
    help() {
      if (this.done) {
        return this.$t('apostrophe:loginResetRequestDone', {
          email: this.doc.data.email
        });
      }
      return this.$t('apostrophe:loginResetPasswordRequest');
    }
  },
  created() {
    if (!this.passwordResetEnabled) {
      this.$emit('set-stage', 'login');
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
  .apos-login-form {
    form {
      position: relative;
      display: flex;
      flex-direction: column;
    }
  }

  .apos-login-form__submit ::v-deep .apos-button {
    height: 47px;
  }
</style>
