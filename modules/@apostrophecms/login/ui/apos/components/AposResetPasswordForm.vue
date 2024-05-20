<template>
  <div
    v-if="passwordResetEnabled && ready"
    class="apos-login-form"
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
          v-model="doc"
          :schema="schema"
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

  .apos-login-form__submit :deep(.apos-button) {
    height: 47px;
  }
</style>
