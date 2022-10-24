// Provides enabled computed status of the password reset feature

export default {
  computed: {
    passwordResetEnabled() {
      return apos.login.passwordResetEnabled;
    }
  }
};
