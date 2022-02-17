<template>
  <div
    class="apos-login__header"
    :class="{'apos-login__header--tiny': tiny}"
  >
    <label
      class="apos-login__project apos-login__project-env"
      :class="[`apos-login__project-env--${env}`]"
    >
      {{ env }}
    </label>
    <label class="apos-login__project apos-login__project-name">
      {{ name }}
    </label>
    <label class="apos-login--error">
      {{ error }}
    </label>
  </div>
</template>

<script>

export default {
  props: {
    env: {
      type: String,
      default: ''
    },
    name: {
      type: String,
      default: ''
    },
    tiny: {
      type: Boolean,
      default: false
    },
    error: {
      type: String,
      default: ''
    }
  }
};
</script>
<style scoped lang='scss'>

.apos-login {

  &__header {
    z-index: $z-index-manager-display;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: flex-start;
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

  &__header--tiny {
    flex-direction: row;
    color: #F8F9FA;

    .apos-login__project {
      opacity: 0.7
    }

    .apos-login__project-name {
      font-size: 21px;

    }

    .apos-login__project-env {
      margin-right: 10px;
    }
  }
}
</style>
