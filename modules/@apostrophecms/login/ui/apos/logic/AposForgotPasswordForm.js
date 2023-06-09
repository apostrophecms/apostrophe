// This is the business logic of the AposForgotPasswordForm Vue component.
// It is in a separate file so that you can override the component's templates
// and styles just by copying the .vue file to your project, and leave the business logic
// unchanged.

import AposLoginFormMixin from 'Modules/@apostrophecms/login/mixins/AposLoginFormMixin';

export default {
  mixins: [ AposLoginFormMixin ],
  emits: [ 'set-stage' ],
  data() {
    return {
      busy: false,
      done: false,
      schema: [
        {
          name: 'email',
          label: 'apostrophe:email',
          placeholder: 'apostrophe:loginEnterEmail',
          type: 'string',
          required: true
        }
      ]
    };
  },
  computed: {
    disabled() {
      return this.doc.hasErrors;
    },
    help() {
      if (this.done) {
        return this.$t('apostrophe:loginResetRequestDone', {
          email: this.doc.data.email
        });
      }
      return this.$t('apostrophe:loginResetPasswordRequest');
    }
  },
  created() {
    if (!this.passwordResetEnabled) {
      this.$emit('set-stage', 'login');
    }
  },
  methods: {
    async submit() {
      if (this.busy) {
        return;
      }
      this.busy = true;
      this.error = '';

      await this.requestReset();
    },
    async requestReset() {
      try {
        await apos.http.post(`${apos.login.action}/reset-request`, {
          busy: true,
          body: { ...this.doc.data }
        });
        this.done = true;
      } catch (e) {
        this.error = e.message || 'apostrophe:loginErrorGeneric';
      } finally {
        this.busy = false;
      }
    }
  }
};
