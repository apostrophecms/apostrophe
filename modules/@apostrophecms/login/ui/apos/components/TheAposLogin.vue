<template>
  <transition name="fade-stage">
    <div
      class="apos-login apos-theme-dark"
      v-show="loaded"
      :class="themeClass"
    >
      <div class="apos-login__wrapper">
        <transition name="fade-body">
          <div class="apos-login__upper" v-show="loaded">
            <div class="apos-login__header">
              <label
                class="apos-login__project apos-login__project-env"
                :class="[`apos-login__project-env--${context.env}`]"
              >
                {{ context.env }}
              </label>
              <label class="apos-login__project apos-login__project-name">
                {{ context.name }}
              </label>
              <label class="apos-login--error">
                {{ error }}
              </label>
            </div>

            <div class="apos-login__body" v-show="loaded">
              <form @submit.prevent="submit">
                <AposSchema
                  :schema="schema"
                  v-model="doc"
                />
                <!-- TODO -->
                <!-- <a href="#" class="apos-login__link">Forgot Password</a> -->
                <AposButton
                  :busy="busy"
                  :disabled="disabled"
                  type="primary"
                  label="Login"
                  button-type="submit"
                  :modifiers="['gradient-on-hover', 'block']"
                  @click="submit"
                />
              </form>
            </div>
          </div>
        </transition>
      </div>
      <transition name="fade-footer">
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
export default {
  name: 'TheAposLogin',
  mixins: [ AposThemeMixin ],
  data() {
    return {
      loaded: false,
      error: '',
      busy: false,
      doc: {
        data: {},
        hasErrors: false
      },
      schema: [
        {
          name: 'username',
          label: 'Username',
          placeholder: 'Enter username',
          type: 'string',
          required: true
        },
        {
          name: 'password',
          label: 'Password',
          placeholder: 'Enter password',
          type: 'password',
          required: true
        }
      ],
      context: {}
    };
  },
  computed: {
    disabled: function () {
      return this.doc.hasErrors;
    }
  },
  async beforeCreate () {
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
      this.context = await apos.http.get(`${apos.login.action}/context`, {
        busy: true
      });
    } catch (e) {
      this.error = 'An error occurred. Please try again.';
    }
  },
  mounted() {
    this.loaded = true;
  },
  methods: {
    async submit() {
      this.busy = true;
      this.error = '';
      try {
        await apos.http.post(`${apos.login.action}/login`, {
          busy: true,
          body: {
            ...this.doc.data,
            session: true
          }
        });
        window.sessionStorage.setItem('aposStateChange', Date.now());
        window.sessionStorage.setItem('aposStateChangeSeen', '{}');
        // TODO handle situation where user should be sent somewhere other than homepage.
        // Redisplay homepage with editing interface
        location.assign(`${apos.prefix}/`);
      } catch (e) {
        this.error = e.message || 'An error occurred. Please try again.';
      } finally {
        this.busy = false;
      }
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
  .fade-footer-enter-to {
    opacity: 1;
  }

  .fade-stage-enter,
  .fade-body-enter,
  .fade-footer-enter {
    opacity: 0;
  }

  .fade-body-enter-active {
    transition: all 0.25s linear;
    transition-delay: 0.6s;
  }

  .fade-body-enter-to {
    transform: translateY(0);
  }

  .fade-body-enter {
    transform: translateY(4px);
  }

  .fade-footer-enter-active {
    transition: opacity 0.4s linear;
    transition-delay: 1s;
  }

  .apos-login {
    display: flex;
    flex-direction: column;
    justify-content: center;
    height: 100vh;
    background-color: var(--a-background-primary);

    &__wrapper {
      width: 100%;
      max-width: $login-container;
      margin: 0 auto;
    }

    &__header {
      z-index: $z-index-manager-display;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: start;
      width: max-content;
    }

    &__project-name {
      @include type-display;
      margin: 0;
      color: var(--a-text-primary);
      text-transform: capitalize;
    }

    &__project-env {
      @include type-base;
      text-transform: capitalize;
      padding: 6px 12px;
      color: var(--a-white);
      background: var(--a-success);
      border-radius: 5px;
      margin-bottom: 15px;

      &--development {
        background: var(--a-danger);
      }

      &--success {
        background: var(--a-warning);
      }
    }

    &--error {
      @include type-help;
      color: var(--a-danger);
      min-height: 13px;
      margin-top: 20px;
      margin-bottom: 15px;
    }

    form {
      position: relative;
      display: flex;
      flex-direction: column;

      button {
        margin-top: $spacing-double;
      }
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
      justify-content: start;
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
