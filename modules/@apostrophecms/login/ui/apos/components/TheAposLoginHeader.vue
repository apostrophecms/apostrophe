<template>
  <div
    class="apos-login__header"
    :class="{'apos-login__header--tiny': tiny, 'apos-login__header--center': !!subtitle}"
  >
    <div class="apos-login__project-header">
      <label
        class="apos-login__project apos-login__project-env"
        :class="[`apos-login__project-env--${env}`]"
      >
        {{ env }}
      </label>
      <label
        v-if="subtitle"
        class="apos-login__project apos-login__project-subtitle"
      >
        {{ subtitle }}
      </label>
    </div>
    <label class="apos-login__project apos-login__project-name">
      {{ title }}
    </label>
    <label
      v-if="help"
      class="apos-login--help"
    >
      {{ help }}
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
    title: {
      type: String,
      default: ''
    },
    subtitle: {
      type: String,
      default: ''
    },
    help: {
      type: String,
      default: ''
    },
    error: {
      type: String,
      default: ''
    },
    tiny: {
      type: Boolean,
      default: false
    }
  }
};
</script>
<style scoped lang='scss'>
.apos-login {
  $this: &;

  &__header {
    z-index: $z-index-manager-display;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: center;
  }

  &__project-header {
    display: flex;
    gap: $spacing-base;
    flex-wrap: nowrap;
    margin-bottom: 15px;
  }

  &__project-subtitle {
    @include type-title;

    & {
      margin: 0;
      opacity: 0.6;
      line-height: 1;
      text-transform: capitalize;
      white-space: nowrap;
    }
  }

  &__project-name {
    @include type-display;

    & {
      margin: 0;
      color: var(--a-text-primary);
      text-transform: capitalize;
    }
  }

  &__project-env {
    @include type-base;

    & {
      text-transform: capitalize;
      padding: 6px 12px;
      color: var(--a-white);
      background: var(--a-success);
      border-radius: 5px;
    }

    &--development {
      background: var(--a-danger);
    }

    &--success, &--staging {
      background: var(--a-warning);
    }
  }

  &--help {
    @include type-label;

    & {
      margin-top: $spacing-double;
      text-align: center;
      white-space: pre-line;
    }
  }

  &--error {
    @include type-help;

    & {
      margin-top: 20px;
      margin-bottom: 15px;
      color: var(--a-danger);
      min-height: 13px;
    }
  }

  &__header--center {
    align-items: center;

    #{$this}__project-header {
      margin-bottom: $spacing-triple;
    }
  }

  &__header--tiny {
    flex-direction: row;
    // stylelint-disable-next-line scale-unlimited/declaration-strict-value
    color: #F8F9FA;

    .apos-login__project {
      opacity: 0.7;
    }

    .apos-login__project-name {
      // stylelint-disable-next-line declaration-property-unit-allowed-list
      font-size: 21px;
    }

    .apos-login__project-env {
      margin-right: 10px;
    }
  }
}
</style>
