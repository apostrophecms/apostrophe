<template>
  <div class="apos-login">
    <form @submit.prevent="submit">
      <h2 v-if="error">{{ error }}</h2>
      <fieldset>
        <label>Username</label>
        <input v-model="username" required />
      </fieldset>
      <fieldset>
        <label>Password</label>
        <input v-model="password" required type="password" />
      </fieldset>
      <fieldset>
        <button type="submit">Log In</button>
      </fieldset>
    </form>
  </div>
</template>

<script>

export default {
  name: 'TheApostropheLogin',
  data() {
    return {
      username: '',
      password: '',
      error: false
    };
  },
  methods: {
    async submit() {
      const self = this;
      self.error = false;
      try {
        await apos.http.post(`${apos.modules['@apostrophecms/login'].action}/login`, {
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
