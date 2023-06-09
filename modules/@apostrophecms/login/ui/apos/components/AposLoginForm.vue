<template>
  <div
    key="1"
    class="apos-login-form"
    v-if="phase === 'beforeSubmit'"
  >
    <TheAposLoginHeader
      :env="context.env"
      :title="context.name"
      :error="$t(error)"
    />

    <div class="apos-login-form__body">
      <form @submit.prevent="submit" data-apos-test="loginForm">
        <AposSchema
          :schema="schema"
          v-model="doc"
        />
        <a
          href="#"
          v-if="passwordResetEnabled"
          class="apos-login-form__link"
          @click.prevent="$emit('set-stage', 'forgotPassword')"
        >{{ $t('apostrophe:loginResetPassword') }}</a>
        <Component
          v-for="requirement in beforeSubmitRequirements"
          :key="requirement.name"
          :is="requirement.component"
          v-bind="getRequirementProps(requirement.name)"
          @done="requirementDone(requirement, $event)"
          @block="requirementBlock(requirement)"
        />
        <AposButton
          data-apos-test="loginSubmit"
          :busy="busy"
          :disabled="disabled"
          type="primary"
          label="apostrophe:login"
          button-type="submit"
          class="apos-login-form__submit"
          :modifiers="['gradient-on-hover', 'block']"
          @click="submit"
        />
      </form>
    </div>
  </div>
  <div
    key="2"
    class="apos-login-form"
    v-else-if="activeSoloRequirement"
  >
    <TheAposLoginHeader
      :env="context.env"
      :title="context.name"
      :error="$t(error)"
      :tiny="true"
    />
    <div class="apos-login-form__body">
      <Component
        v-if="!fetchingRequirementProps"
        v-bind="getRequirementProps(activeSoloRequirement.name)"
        :is="activeSoloRequirement.component"
        :success="activeSoloRequirement.success"
        :error="activeSoloRequirement.error"
        @done="requirementDone(activeSoloRequirement, $event)"
        @confirm="requirementConfirmed(activeSoloRequirement)"
      />
    </div>
  </div>
</template>

<script>
import AposLoginFormLogic from 'Modules/@apostrophecms/login/logic/AposLoginForm';

export default {
  name: 'AposLoginForm',
  mixins: [ AposLoginFormLogic ],
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

    &__link {
      @include type-large;
      position: relative;
      // AposSchema adds $spacing-quadruple margin bottom
      top: -$spacing-triple;
      display: block;
      text-align: right;
      text-decoration: underline;
      text-underline-offset: 2px;

      &:hover,
      &:focus,
      &:active {
        color: var(--a-text-primary);
      }
    }
  }

  .apos-login-form__submit ::v-deep .apos-button {
    height: 47px;
  }
</style>
