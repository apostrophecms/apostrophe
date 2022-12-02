<template>
  <transition name="fade-stage">
    <div
      class="apos-login apos-theme-dark"
      data-apos-test="loginForm"
      v-show="loaded"
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
        <div class="apos-login__footer" v-show="loaded">
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
import AposThemeMixin from 'Modules/@apostrophecms/ui/mixins/AposThemeMixin';

const STAGES = [
  'login',
  'forgotPassword',
  'resetPassword'
];

export default {
  name: 'TheAposLogin',
  mixins: [ AposThemeMixin ],
  data() {
    return {
      stage: STAGES[0],
      mounted: false,
      beforeCreateFinished: false,
      error: '',
      passwordResetData: {},
      context: {}
    };
  },
  computed: {
    loaded() {
      return this.mounted && this.beforeCreateFinished;
    },
    showNav() {
      return this.stage !== STAGES[0];
    },
    homeUrl() {
      return `${apos.prefix}/`;
    }
  },
  // We need it here and not in the login form because the version used in the footer.
  // The context will be passed to every form, might be a good thing in the future.
  async beforeCreate() {
    const stateChange = parseInt(window.sessionStorage.getItem('aposStateChange'));
    const seen = JSON.parse(window.sessionStorage.getItem('aposStateChangeSeen') || '{}');
    if (!seen[window.location.href]) {
      const lastModified = Date.parse(document.lastModified);
      if (stateChange && lastModified && (lastModified < stateChange)) {
        seen[window.location.href] = true;
        window.sessionStorage.setItem('aposStateChangeSeen', JSON.stringify(seen));
        location.reload();
        return;
      }
    }
    try {
      this.context = await apos.http.post(`${apos.login.action}/context`, {
        busy: true
      });
    } catch (e) {
      this.context = {};
      this.error = e.message || 'apostrophe:loginErrorGeneric';
    } finally {
      this.beforeCreateFinished = true;
    }
  },
  created() {
    const url = new URL(document.location);
    const data = {
      email: url.searchParams.get('email'),
      reset: url.searchParams.get('reset')
    };
    if (data.email && data.reset) {
      this.passwordResetData = data;
      this.setStage('resetPassword');
    }
  },
  mounted() {
    this.mounted = true;
  },
  methods: {
    setStage(name) {
      // 1. Enabled status per stage. A bit cryptic but effective.
      // Search for a method composed of the `name` + `Enabled`
      // (e.g. `forgotPasswordEnabled` and execute it (should return boolean).
      // If no method is found it is enabled. Fallback to the default stage.
      const enabled = this[`${name}Enabled`]?.() ?? true;
      if (!enabled) {
        this.stage = STAGES[0];
        return;
      }
      // 2. Set it only if it's a known stage
      if (STAGES.includes(name)) {
        this.stage = name;
        return;
      }
      // 3. Fallback to the default stage
      this.stage = STAGES[0];
    },
    forgotPasswordEnabled() {
      return apos.login.passwordResetEnabled;
    },
    resetPasswordEnabled() {
      return apos.login.passwordResetEnabled;
    },
    onRedirect(loc) {
      window.sessionStorage.setItem('aposStateChange', Date.now());
      window.sessionStorage.setItem('aposStateChangeSeen', '{}');
      location.assign(loc);
    }
  }
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
    transition: opacity 0.2s linear;
    transition-delay: 0.3s;
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
    transition: all 0.25s linear;
    transition-delay: 0.6s;
  }

  .fade-body-leave-active {
    transition: all 0.25s linear;
  }

  .fade-body-enter-to, .fade-body-leave {
    transform: translateY(0);
  }

  .fade-body-enter, .fade-body-leave-to {
    transform: translateY(4px);
  }

  .fade-outer-enter-active {
    transition: opacity 0.4s linear;
    transition-delay: 1s;
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
      justify-content: space-between;
      align-items: center;
      padding: $spacing-triple;
    }

    &__link {
      @include type-large;
      display: inline-block;
      text-decoration: underline;
      text-underline-offset: 2px;

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
      position: absolute;
      right: 0;
      bottom: 32px;
      left: 0;
      display: flex;
      width: 100%;
      max-width: $login-container;
      margin: auto;
      align-items: center;
      justify-content: flex-start;
    }

    &__project-version {
      overflow: hidden;
      text-overflow: clip;
      white-space: nowrap;
      color: var(--a-base-5);
      margin-right: 0;
      margin-left: auto;
    }
  }
</style>
