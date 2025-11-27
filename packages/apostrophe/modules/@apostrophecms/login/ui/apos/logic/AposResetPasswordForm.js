// This is the business logic of the AposResetPasswordForm Vue component.
// It is in a separate file so that you can override the component's templates
// and styles just by copying the .vue file to your project, and leave the
// business logic unchanged.

import AposLoginFormMixin from 'Modules/@apostrophecms/login/mixins/AposLoginFormMixin';

export default {
  name: 'AposResetPasswordForm',
  mixins: [ AposLoginFormMixin ],
  props: {
    data: {
      type: Object,
      default: function() {
        return {};
      }
    }
  },
  emits: [ 'set-stage' ],
  data() {
    return {
      ready: false,
      busy: false,
      valid: true,
      done: false,
      contextErrorReceived: false,
      schema: [
        {
          name: 'password',
          label: 'apostrophe:newPassword',
          type: 'password',
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
      if (!this.valid) {
        return '';
      }
      if (this.done) {
        return this.error ? '' : this.$t('apostrophe:loginResetDone');
      }
      return this.$t('apostrophe:loginResetInfo', {
        email: this.data.email
      });
    }
  },
  async created() {
    if (!this.passwordResetEnabled) {
      this.$emit('set-stage', 'login');
      return;
    }
    this.busy = true;
    await this.verify();
    this.ready = true;
  },

  methods: {
    async submit() {
      if (this.busy) {
        return;
      }
      this.busy = true;
      this.error = '';

      await this.reset();
    },
    async verify() {
      try {
        await apos.http.get(`${apos.login.action}/reset`, {
          busy: true,
          qs: { ...this.data }
        });
        this.valid = true;
      } catch (e) {
        this.valid = false;
        this.done = true;
        this.error = e.message || 'apostrophe:loginErrorGeneric';
      } finally {
        this.busy = false;
      }
    },
    async reset() {
      try {
        await apos.http.post(`${apos.login.action}/reset`, {
          busy: true,
          body: {
            ...this.data,
            ...this.doc.data
          }
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
