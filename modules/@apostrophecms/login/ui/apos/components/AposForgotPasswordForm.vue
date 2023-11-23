<template>
  <div
    v-if="passwordResetEnabled"
    class="apos-login-form"
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
          v-model="doc"
          :schema="schema"
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
import AposForgotPasswordFormLogic from 'Modules/@apostrophecms/login/logic/AposForgotPasswordForm';

export default {
  name: 'AposForgotPasswordForm',
  mixins: [ AposForgotPasswordFormLogic ],
  emits: [ 'set-stage' ]
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

  .apos-login-form__submit :deep(.apos-button) {
    height: 47px;
  }
</style>
