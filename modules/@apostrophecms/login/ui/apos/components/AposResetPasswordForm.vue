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
import AposResetPasswordFormLogic from 'Modules/@apostrophecms/login/logic/AposResetPasswordForm';

export default {
  name: 'AposResetPasswordForm',
  mixins: [ AposResetPasswordFormLogic ],
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
  .apos-login-form__submit ::v-deep .apos-button {
    height: 47px;
  }
</style>
