<template>
  <transition name="fade-stage">
    <div
      v-show="loaded"
      class="apos-login apos-theme-dark"
      data-apos-test="loginForm"
      :class="themeClass"
    >
      <transition name="fade-outer">
        <div v-if="showNav" class="apos-login__nav">
          <a
            href="#"
            class="apos-login__link apos-login--arrow-left"
            @click.prevent="setStage('login')"
          >{{ $t('apostrophe:loginBack') }}</a>
          <a
            :href="homeUrl"
            class="apos-login__link apos-login--arrow-right"
          >{{ $t('apostrophe:loginHome') }}</a>
        </div>
      </transition>
      <div class="apos-login__wrapper">
        <transition name="fade-body" mode="out-in">
          <AposForgotPasswordForm
            v-if="loaded && stage === 'forgotPassword'"
            :context="context"
            :context-error="error"
            @redirect="onRedirect"
            @set-stage="setStage"
          />
          <AposResetPasswordForm
            v-else-if="loaded && stage === 'resetPassword'"
            :context="context"
            :data="passwordResetData"
            :context-error="error"
            @redirect="onRedirect"
            @set-stage="setStage"
          />
          <AposLoginForm
            v-else-if="loaded"
            :context="context"
            :context-error="error"
            @redirect="onRedirect"
            @set-stage="setStage"
          />
        </transition>
      </div>
      <transition name="fade-outer">
        <div v-show="loaded" class="apos-login__footer">
          <AposLogo class="apos-login__logo" />
          <label class="apos-login__project-version">
            Version {{ context.version }}
          </label>
        </div>
      </transition>
    </div>
  </transition>
</template>

<script>
import TheAposLoginLogic from 'Modules/@apostrophecms/login/logic/TheAposLogin';

export default {
  name: 'TheAposLogin',
  mixins: [ TheAposLoginLogic ]
};
</script>

<style lang="scss">
  .apos-login-page {
    margin: 0;
  }
</style>

<style lang="scss" scoped>
  $login-container: 330px;

  .apos-login__logo {
    width: 100%;
    max-width: 150px;
  }

  .fade-stage-enter-active {
    transition: opacity 200ms linear;
    transition-delay: 300ms;
  }

  .fade-stage-enter-to,
  .fade-body-enter-to,
  .fade-outer-enter-to,
  .fade-body-leave {
    opacity: 1;
  }

  .fade-stage-enter,
  .fade-body-enter,
  .fade-outer-enter,
  .fade-body-leave-to {
    opacity: 0;
  }

  .fade-body-enter-active {
    transition: all 250ms linear;
    transition-delay: 600ms;
  }

  .fade-body-leave-active {
    transition: all 250ms linear;
  }

  .fade-body-enter-to, .fade-body-leave {
    transform: translateY(0);
  }

  .fade-body-enter, .fade-body-leave-to {
    transform: translateY(4px);
  }

  .fade-outer-enter-active {
    transition: opacity 400ms linear;
    transition-delay: 1000ms;
  }

  .apos-login {
    display: flex;
    flex-direction: column;
    justify-content: center;
    height: 100vh;
    background-color: var(--a-background-primary);

    &__nav {
      position: absolute;
      top: 0;
      right: 0;
      left: 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: $spacing-triple;
    }

    &__link {
      @include type-large;

      & {
        display: inline-block;
        text-decoration: underline;
        text-underline-offset: 2px;
      }

      &:hover,
      &:focus,
      &:active {
        color: var(--a-text-primary);
      }
    }

    &--arrow-left,
    &--arrow-right {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: $spacing-half;
    }

    &--arrow-left::before,
    &--arrow-right::after {
      content: '';
      width: 3px;
      height: 3px;
      border: solid var(--a-text-primary);
      border-width: 3px 3px 0 0;
    }

    &--arrow-right::after {
      transform: rotate(45deg);
    }

    &--arrow-left::before {
      transform: rotate(-135deg);
    }

    &__wrapper {
      width: 100%;
      max-width: $login-container;
      margin: 0 auto;
    }

    &__loader {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      width: 100vw;
      height: 100vh;

      .apos-spinner {
        width: 38px;
        height: 38px;
        margin-top: 20px;
      }
    }

    &__footer {
      @include type-base;

      & {
        position: absolute;
        right: 0;
        bottom: 32px;
        left: 0;
        display: flex;
        align-items: center;
        justify-content: flex-start;
        width: 100%;
        margin: auto;
        max-width: $login-container;
      }
    }

    &__project-version {
      overflow: hidden;
      margin-right: 0;
      margin-left: auto;
      color: var(--a-base-5);
      text-overflow: clip;
      white-space: nowrap;
    }
  }
</style>
