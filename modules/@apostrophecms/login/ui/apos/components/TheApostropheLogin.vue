<template>
  <div class="apos-login apos-theme-dark">
    <form @submit.prevent="submit">
      <img :src="loginImg" />
      <h2 v-if="error">{{ error }}</h2>
      <AposInputString
        :field="usernameField.field"
        :status="usernameField.status"
        :value="usernameField.value"
        :modifiers="['dark', 'short']"
      />
     <AposInputString
        :field="passwordField.field"
        :type="passwordField.type"
        :status="passwordField.status"
        :value="passwordField.value"
        :modifiers="['dark', 'short']"
      />
      <fieldset>
        <button type="submit">Log In</button>
      </fieldset>
    </form>
  </div>
</template>

<script>
import loginImg from '../assets/login.jpg'

export default {
  name: 'TheApostropheLogin',
  data() {
    return {
      password: '',
      error: false,
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
      loginImg: '/apos-frontend/' + loginImg
    };
  },
  methods: {
    async submit() {
      const self = this;
      self.error = false;
      try {
        await apos.http.post(`${apos.modules['@apostrophecms/login'].action}/login`, {
          busy: true,
          body: {
            username: self.username,
            password: self.password
          }
        });
        // TODO handle situation where user should be sent somewhere other than homepage.
        // Redisplay homepage with editing interface
        window.location.href = `/${apos.prefix}`;
      } catch (e) {
        self.error = e.message || 'An error occurred. Please try again.';
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
    position: absolute;
    top: 0;
    left: 0;
    width: 25vw;
    min-width: 400px;
    height: 100vh;
    background: var(--a-base-10);
    opacity: 0.6;
    mix-blend-mode: normal;

    img {
      position: absolute;
      width: 100vw;
    }
  }
</style>
