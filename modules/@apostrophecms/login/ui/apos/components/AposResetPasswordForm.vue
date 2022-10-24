<template>
  <p style="color: var(--a-text-primary);">
    Reset Password Form
  </p>
</template>

<script>
import AposLoginPasswordResetEnabledMixin from 'Modules/@apostrophecms/login/mixins/AposLoginPasswordResetEnabledMixin';

export default {
  name: 'AposResetPasswordForm',
  mixins: [ AposLoginPasswordResetEnabledMixin ],
  emits: [ 'set-stage' ]
};
</script>
