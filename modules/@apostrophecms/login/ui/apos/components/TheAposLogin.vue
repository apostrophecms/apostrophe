<template>
  <transition name="fade-stage">
    <div class="apos-login apos-theme-dark" v-show="loaded">
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
              <label class="apos-login__project apos-login__project-name">{{ context.name }}</label>
              <label class="apos-login--error">{{ error }}</label>
            </div>

            <div class="apos-login__body" v-show="loaded">
              <form>
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
                  :modifiers="['gradient-on-hover']"
                  @click="submit"
                />
              </form>
            </div>
          </div>
        </transition>
      </div>
      <transition name="fade-footer">
        <div class="apos-login__footer" v-show="loaded">
          <AposLogo class="apos-login__logo"/>
          <label class="apos-login__logo-name">ApostropheCMS</label>
          <label class="apos-login__project-version">Version {{ context.version }}</label>
        </div>
      </transition>
    </div>
  </transition>
</template>

<script>
export default {
  name: 'TheAposLogin',
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
          type: 'string',
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
    try {
      this.context = await apos.http.get(`${apos.modules['@apostrophecms/login'].action}/context`, {
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
        await apos.http.post(`${apos.modules['@apostrophecms/login'].action}/login`, {
          busy: true,
          body: this.doc.data
        });
        // TODO handle situation where user should be sent somewhere other than homepage.
        // Redisplay homepage with editing interface
        window.location.href = `/${apos.prefix}`;
      } catch (e) {
        this.error = e.message || 'An error occurred. Please try again.';
      } finally {
        this.busy = false;
      }
    }
  }
}
</script>

<style lang="scss" scoped>
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
      width: 320px;
      margin: 0 auto;
    }

    &__loader {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      width: 100vw;
      height: 100vh;
      font-size: map-get($font-sizes, heading);
      font-weight: lighter;

      .apos-spinner {
        width: 38px;
        height: 38px;
        margin-top: 20px;
      }
    }

    &__header {
      z-index: $z-index-manager-display;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: start;
      width: max-content;
    }

    &__project {
      color: var(--a-text-primary);
      letter-spacing: 1px;
      text-transform: capitalize;
    }

    &__project-name {
      font-size: map-get($font-sizes, project-title);
    }

    &__project-env {
      padding: 6px 12px;
      color: var(--a-white);
      background: var(--a-success);
      font-size: map-get($font-sizes, default);
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
      color: var(--a-danger);
      min-height: 13px;
      font-size: map-get($font-sizes, meta);
      letter-spacing: 1.5px;
      text-transform: uppercase;
      margin-top: 20px;
      margin-bottom: 15px;
    }

    form {
      position: relative;
      display: flex;
      flex-direction: column;

      .apos-field {
        margin-top: 20px;
        letter-spacing: 0.5px;
      }

      .apos-login__link {
        margin-top: 10px;
        margin-left: auto;
        margin-right: 0;
        color: var(--a-base-5);
        font-size: map-get($font-sizes, input-label);
        font-weight: normal;
        letter-spacing: 1px;
        text-decoration-line: underline;
      }

      button {
        letter-spacing: 0.5px;
        margin-top: 40px;
      }
    }

    &__footer {
      position: absolute;
      right: 0;
      bottom: 32px;
      left: 0;
      display: flex;
      width: 400px;
      margin: auto;
      align-items: center;
      justify-content: start;
      letter-spacing: 1px;
      font-size: map-get($font-sizes, input-label);
    }

    &__logo-name {
      color: var(--a-text-primary);
      margin-left: 10px;
      margin-right: 30px;
    }

    &__project-version {
      overflow: hidden;
      text-overflow: clip;
      white-space: nowrap;
      color: var(--a-base-5);
      margin-right: 0;
      margin-left: auto;
      font-weight: normal;
    }
  }
</style>
