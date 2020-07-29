<template>
  <div class="apos-login apos-theme-dark">
    <div class="apos-login__overlay"></div>
    <div class="apos-login__menu-overlay"></div>
    <AposLoginBackground />
    <h2 class="apos-login--error" v-if="error">{{ error }}</h2>
    <label v-if="env" class="apos-login__project apos-login__project-env" :class="[`apos-login__project-env--${env}`]">{{ env }}</label>
    <label class="apos-login__project apos-login__project-name">{{ projectName }}</label>
    <label class="apos-login__project apos-login__project-version">{{ version }}</label>
    <form>
      <AposInputString
        @input="fill($event, 'usernameField')"
        :field="usernameField.field"
        :status="usernameField.status"
        :value="usernameField.value"
        :modifiers="['dark']"
      />
     <AposInputString
        @input="fill($event, 'passwordField')"
        :field="passwordField.field"
        :type="passwordField.type"
        :status="passwordField.status"
        :value="passwordField.value"
        :modifiers="['dark']"
      />
      <a href="#" class="apos-login__link">Forgot Password</a>
      <AposButton
        class="apos-field--short"
        :busy="busy"
        :disabled="busy"
        type="primary"
        label="Login"
        :modifiers="['gradient-on-hover']"
        @click="submit"
      />
    </form>
  </div>
</template>

<script>
import loginImg from '../assets/login.jpg'

export default {
  name: 'TheApostropheLogin',
  data() {
    return {
      error: false,
      busy: false,
      usernameField: {
        field: {
          name: 'username',
          placeholder: 'Enter username',
          label: 'Username',
          required: true
        },
        status: {},
        value: { data: '' }
      },
      passwordField: {
        field: {
          name: 'password',
          type: 'password',
          placeholder: 'Enter password',
          label: 'Password',
          required: true
        },
        status: {},
        value: { data: '' }
      },
      loginImg: '/apos-frontend/' + loginImg,
      env: apos.context.env,
      version: apos.context.version,
      projectName: apos.context.name.replace(/-/g, ' ')
    };
  },
  methods: {
    fill(value, field) {
      this[field].value = value
    },
    async submit() {
      const self = this;
      self.busy = true;
      self.error = false;
      try {
        if (!self.usernameField.value.data || !self.passwordField.value.data) {
          throw new Error('Username and password required.');
        }
        await apos.http.post(`${apos.modules['@apostrophecms/login'].action}/login`, {
          busy: true,
          body: {
            username: self.usernameField.value.data,
            password: self.passwordField.value.data
          }
        });
        // TODO handle situation where user should be sent somewhere other than homepage.
        // Redisplay homepage with editing interface
        window.location.href = `/${apos.prefix}`;
      } catch (e) {
        self.error = e.message || 'An error occurred. Please try again.';
      } finally {
        self.busy = false;
      }
    },
    toggleDropdown: function () {
      console.log(this);
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

    &__project {
      z-index: $z-index-manager-display;
      width: max-content;
      max-width: 320px;
      color: var(--a-text-primary);
      letter-spacing: 1px;
      margin-left: 32px;
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
        align-self: end;
        margin-top: 10px;
        color: var(--a-base-5);
        font-size: map-get($font-sizes, input-label);
        letter-spacing: 1px;
        text-decoration-line: underline;
      }

      button {
        letter-spacing: 0.5px;
        margin-top: 40px;
      }

      .apos-login--error {
        color: var(--a-danger);
        letter-spacing: 1.5px;
        text-transform: uppercase;
      }
    }
  }
</style>
