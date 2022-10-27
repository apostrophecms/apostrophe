<template>
  <div
    class="apos-login-form"
    v-if="passwordResetEnabled && ready"
  >
    <TheAposLoginHeader
      :env="context.env"
      :title="$t('apostrophe:loginResetPassword')"
      :subtitle="context.name"
      :help="help"
      :error="$t(error)"
    />
    <div class="apos-login-form__body">
      <AposButton
        v-if="done && valid"
        data-apos-test="loginBack"
        :busy="busy"
        type="primary"
        label="apostrophe:loginBack"
        class="apos-login-form__submit"
        :modifiers="['block']"
        @click="$emit('set-stage', 'login')"
      />
      <form
        v-else-if="!done && valid"
        data-apos-test="pwdResetForm"
        @submit.prevent="submit"
      >
        <AposSchema
          :schema="schema"
          v-model="doc"
        />
        <AposButton
          data-apos-test="pwdResetSubmit"
          :busy="busy"
          :disabled="disabled"
          type="primary"
          label="apostrophe:save"
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
  name: 'AposResetPasswordForm',
  mixins: [ AposLoginFormMixin ],
  props: {
    data: {
      type: Object,
      default: function() {
        return {};
      }
    }
  },
  emits: [ 'set-stage' ],
  data() {
    return {
      ready: false,
      busy: false,
      valid: true,
      done: false,
      contextErrorReceived: false,
      schema: [
        {
          name: 'password',
          label: 'apostrophe:newPassword',
          type: 'password',
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
      if (!this.valid) {
        return '';
      }
      if (this.done) {
        return this.error ? '' : this.$t('apostrophe:loginResetDone');
      }
      return this.$t('apostrophe:loginResetInfo', {
        email: this.data.email
      });
    }
  },
  async created() {
    if (!this.passwordResetEnabled) {
      this.$emit('set-stage', 'login');
      return;
    }
    this.busy = true;
    await this.verify();
    this.ready = true;
  },

  methods: {
    async submit() {
      if (this.busy) {
        return;
      }
      this.busy = true;
      this.error = '';

      await this.reset();
    },
    async verify() {
      try {
        await apos.http.get(`${apos.login.action}/reset`, {
          busy: true,
          qs: { ...this.data }
        });
        this.valid = true;
      } catch (e) {
        this.valid = false;
        this.done = true;
        this.error = e.message || 'apostrophe:loginErrorGeneric';
      } finally {
        this.busy = false;
      }
    },
    async reset() {
      try {
        await apos.http.post(`${apos.login.action}/reset`, {
          busy: true,
          body: {
            ...this.data,
            ...this.doc.data
          }
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
