<template>
  <div class="apos-login apos-theme-dark">
    <div class="apos-login__overlay"></div>
    <div class="apos-login__menu-overlay"></div>
    <AposLoginBackground />

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

    <div class="apos-login__body">
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

    <div class="apos-login__footer">
      <AposLogo class="apos-login__logo"/>
      <label class="apos-login__logo-name">ApostropheCMS</label>
      <label class="apos-login__project-version">Version {{ context.version }}</label>
    </div>
  </div>
</template>

<script>
export default {
  name: 'TheAposLogin',
  data() {
    return {
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
  async beforeCreate () {
    try {
      this.context = await apos.http.get(`${apos.modules['@apostrophecms/login'].action}/context`, {
        busy: true
      });
    } catch (e) {
      this.error = 'An error occurred. Please try again.';
    }
  },
  computed: {
    disabled: function () {
      return this.doc.hasErrors;
    }
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
  .apos-login {
    display: flex;
    flex-direction: column;
    justify-content: center;
    height: 100vh;

    &:after {
      position: absolute;
      content: '';
      top: 0;
      left: 0;
      display: block;
      width: 100%;
      height: 100%;
      background: linear-gradient(38.7deg, rgba(179, 39, 191, 0.3), rgba(30, 30, 76, 0.3), rgba(0, 192, 154, 0.3));
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

    &__overlay {
      z-index: $z-index-default;
      position: absolute;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: var(--a-base-10);
      opacity: 0.3;
    }

    &__menu-overlay {
      z-index: $z-index-manager-display;
      position: absolute;
      top: 0;
      left: 0;
      width: 400px;
      height: 100vh;
      background: var(--a-base-10);
      opacity: 0.6;
    }

    &__header {
      z-index: $z-index-manager-display;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: start;
      width: max-content;
      max-width: 320px;
      margin-left: 32px;
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
      padding: 5px 10px;
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
      z-index: $z-index-manager-toolbar;
      position: relative;
      margin-left: 32px;
      display: flex;
      flex-direction: column;
      width: 320px;

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
      z-index: $z-index-manager-display;
      position: fixed;
      bottom: 32px;
      left: 32px;
      display: flex;
      align-items: center;
      justify-content: start;
      width: 320px;
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
