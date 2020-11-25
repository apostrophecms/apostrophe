<template>
  <component
    :is="href ? 'a' : 'button'"
    v-on="href ? {} : {click: click}"
    :href="href.length ? href : false"
    class="apos-button"
    :class="modifierClass" :tabindex="tabindex"
    :disabled="isDisabled"
    :type="buttonType"
    :role="role"
    v-tooltip="tooltip"
  >
    <transition name="fade">
      <AposSpinner :color="spinnerColor" v-if="busy" />
    </transition>
    <div class="apos-button__content">
      <AposIndicator
        v-if="icon"
        :icon="icon"
        :icon-size="iconSize"
        class="apos-button__icon"
        fill-color="currentColor"
      />
      <!-- <component
        :size="iconSize" class="apos-button__icon"
        v-if="icon" :is="icon"
        
      /> -->
      <span class="apos-button__label" :class="{ 'apos-sr-only' : iconOnly }">
        {{ label }}
      </span>
    </div>
  </component>
</template>

<script>

export default {
  name: 'AposButton',
  props: {
    label: {
      required: true,
      type: String
    },
    modifiers: {
      type: Array,
      default() {
        return [];
      }
    },
    href: {
      type: String,
      default: ''
    },
    iconSize: {
      type: Number,
      default: 15
    },
    disabled: Boolean,
    busy: Boolean,
    icon: {
      type: String,
      default: null
    },
    type: {
      type: String,
      default: null
    },
    iconOnly: {
      type: Boolean,
      default: false
    },
    state: {
      type: Array,
      default() {
        return [];
      }
    },
    disableFocus: Boolean,
    buttonType: {
      type: [ String, Boolean ],
      default: false
    },
    role: {
      type: [ String, Boolean ],
      default: false
    },
    tooltip: {
      type: [ String, Object, Boolean ],
      default: false
    }
  },
  emits: [ 'click' ],
  data() {
    return {
      contextMenuOpen: true
    };
  },
  computed: {
    tabindex() {
      return this.disableFocus ? '-1' : '0';
    },
    modifierClass() {
      const modifiers = [];

      if (this.modifiers) {
        this.modifiers.forEach((m) => {
          modifiers.push(`apos-button--${m}`);
        });
      }

      if (this.busy) {
        modifiers.push('apos-button--outline', 'apos-button--busy');
      }

      if (this.type) {
        modifiers.push(`apos-button--${this.type}`);
      }

      if (this.iconOnly) {
        modifiers.push('apos-button--icon-only');
      }

      if (this.state && this.state.length) {
        this.state.forEach((state) => {
          modifiers.push(`is-${state}`);
        });
      }

      if (modifiers.length > 0) {
        return modifiers.join(' ');
      } else {
        return false;
      }
    },
    spinnerColor () {
      if (this.type === 'danger') {
        return '--a-danger';
      }
      if (this.busy && this.disabled) {
        return '--a-white';
      }
      if (this.type === 'outline') {
        return '--a-base-5';
      }

      return null;
    },
    isDisabled() {
      return (this.disabled || this.busy);
    }
  },
  methods: {
    click($event) {
      this.$emit('click', $event);
    }
  }
};
</script>
<style lang="scss" scoped>
  .apos-button {
    @include type-base;
    position: relative;
    display: inline-block;
    overflow: hidden;
    padding: 10px 20px;
    border: 1px solid var(--a-base-5);
    color: var(--a-text-primary);
    border-radius: var(--a-border-radius);
    background-color: var(--a-base-9);
    transition: all 0.2s ease;
    text-decoration: none;

    &:hover {
      cursor: pointer;
      background-color: var(--a-base-8);
    }
    &:active,
    &.is-active {
      background-color: var(--a-base-7);
    }
    &:focus {
      box-shadow: 0 0 0 1px var(--a-base-7), 0 0 0 3px var(--a-base-8);
      outline: none;
      border: 1px solid var(--a-base-3);
    }
    &:hover:not([disabled]),
    &:focus:not([disabled]) {
      transform: translateY(-1px);
    }
    &[disabled] {
      background-color: var(--a-base-9);
      border: 1px solid var(--a-base-8);
      color: var(--a-base-5);
      &:hover {
        cursor: not-allowed;
      }
    }
    &[disabled].apos-button--busy {
      border: 1px solid var(--a-base-1);
    }
    .apos-spinner {
      position: absolute;
      top: 0;
      right: 0;
      bottom: 0;
      left: 0;
      margin: auto;
    }

    .apos-spinner.fade-enter-active, .fade-leave-active {
      transition: all 0.2s ease;
    }

    .apos-spinner.fade-enter, .fade-leave-to {
      opacity: 0;
    }
  }

  .apos-button--outline,
  .apos-button[disabled].apos-button--outline {
    background-color: transparent;
  }

  .apos-button--small {
    padding: 7.5px 10px;
  }

  .apos-button--quiet {
    padding: 0;
    border: none;
    color: var(--a-primary);
    background-color: transparent;
    &:hover,
    &:active,
    &.is-active,
    &:focus {
      background-color: transparent;
      text-decoration: underline;
      color: var(--a-primary-button-hover);
    }
    &:focus {
      box-shadow: none;
      outline: none;
      border: none;
    }
    &[disabled] {
      background-color: transparent;
      border: none;
      &:hover {
        text-decoration: none;
        cursor: not-allowed;
        color: var(--a-base-5);
      }
    }
  }

  .apos-button--gradient-on-hover {
    z-index: $z-index-base;
    &:after {
      z-index: $z-index-default;
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-size: 100%;
      background-image: linear-gradient(
        46deg,
        var(--a-brand-gold) 0%,
        var(--a-brand-red) 26%,
        var(--a-brand-magenta) 47%,
        var(--a-brand-blue) 76%,
        var(--a-brand-green) 100%
      );
      opacity: 0;
      transition: all 0.3s ease;
    }
    &:hover:after {
      opacity: 0.4;
    }
    &[disabled].apos-button--busy:after {
      background-size: 400% 400%;
      opacity: 1;
    }
    // extra strength :sweat-smile:
    &.apos-button[disabled].apos-button--busy {
      border: none;
    }
    &[disabled].apos-button--busy:after {
      animation: animateGradient 10s ease-in-out infinite;
    }
    .apos-button__label {
      position: relative;
    }
    .apos-button__label,
    .apos-spinner {
      z-index: calc(#{$z-index-default} + 1);
    }
  }

  .apos-button--block {
    display: block;
    width: 100%;
    height: 47px;
    max-width: 400px;
  }

  .apos-button--outline {
    &:hover {
      background-color: var(--a-base-9);
    }
    &:active,
    &.is-active {
      background-color: var(--a-base-8);
    }
    &:focus {
      box-shadow: 0 0 3px var(--a-base-2);
    }
    &[disabled] {
      border: 1px solid $input-color-disabled;
      color: $input-color-disabled;
      background-color: transparent;
    }
    &.apos-button--busy {
      color: var(--a-base-5);
    }
  }

  .apos-button--icon-right {
    .apos-button__content {
      flex-direction: row-reverse;
    }
    .apos-button__icon {
      margin-right: 0;
      margin-left: 5px;
    }
  }

  .apos-button--primary {
    border: 1px solid var(--a-primary);
    color: var(--a-white);
    background: var(--a-primary);
    &:hover {
      background-color: var(--a-primary-button-hover);
    }
    &:active,
    &.is-active {
      background-color: var(--a-primary-button-active);
    }
    &:focus {
      box-shadow: 0 0 0 1px var(--a-base-7),
        0 0 0 3px var(--a-primary-button-disabled);
    }
    &[disabled] {
      border: 1px solid var(--a-primary-button-disabled);
      color: var(--a-white);
      background-color: var(--a-primary-button-disabled);
    }
    &[disabled].apos-button--busy {
      border: 1px solid var(--a-primary-button-disabled);
    }
  }

  .apos-button--input {
    background-color: var(--a-base-1);
    color: var(--a-base-10);
    border-color: var(--a-base-4);
    &:hover {
      background-color: var(--a-base-1);
    }
    &:active,
    &.is-active {
      background-color: var(--a-base-1);
    }
    &:focus {
      box-shadow: 0 0 0 1px var(--a-base-7), 0 0 0 3px var(--a-base-1);
    }
    &[disabled] {
      background-color: var(--a-base-4);
      color: var(--a-base-7);
    }
    &[disabled].apos-button--busy {
      border: 1px solid var(--a-base-1);
    }
  }

  .apos-button--danger {
    border: 1px solid var(--a-danger);
    color: var(--a-white);
    background-color: var(--a-danger);
    &:hover {
      background-color: var(--a-danger-button-hover);
    }
    &:active,
    &.is-active {
      background-color: var(--a-danger-button-active);
    }
    &:focus {
      box-shadow: 0 0 0 1px var(--a-base-7),
        0 0 0 3px var(--a-danger-button-disabled);
    }
    &[disabled] {
      border: 1px solid var(--a-danger-button-disabled);
      color: var(--a-white);
      background-color: var(--a-danger-button-disabled);
    }
    &[disabled].apos-button--busy {
      border: 1px solid var(--a-danger-button-disabled);
    }
    .apos-spinner__svg {
      color: var(--a-danger);
    }
  }

  .apos-button--group {
    background-color: var(--a-background-primary);
    border: none;
    &:hover {
      background-color: var(--a-base-9);
    }
    &:focus {
      background-color: var(--a-base-8);
    }
  }

  .apos-button--busy {
    .apos-button__content {
      opacity: 0;
    }
    .apos-spinner {
      opacity: 1;
    }
  }

  .apos-button--icon-only {
    padding: 10px;
    .apos-button__icon {
      margin-right: 0;
    }
  }

  .apos-button--rich-text {
    background-color: var(--a-background);
    border-radius: 0;
    &:hover {
      background-color: var(--a-base-8);
    }
    &:focus, &:active {
      background-color: var(--a-base-9);
    }
  }

  .apos-button--icon.apos-button--small {
    padding: 7.5px 10px;
  }

  .apos-button__label {
    display: inline-block;
  }

  .apos-button__content {
    display: flex;
    align-items: center;
    justify-content: center;
    transition: opacity 0.2s ease;
  }

  .apos-button__icon {
    display: inline-flex;
    margin-right: 5px;
    align-items: center;
  }

  .apos-button:not(.apos-button--icon-only) .apos-button__icon {
    max-height: 13px;
  }

  .apos-button--danger-on-hover:hover {
    color: var(--a-danger);
  }

  .apos-button--round {
    border-radius: 50%;
  }

  .apos-button--tiny {
    padding: 3px;
  }

  .apos-button--inline {
    padding: 0;
    &, &:hover, &:active, &:focus {
      border: 0;
      background-color: transparent;
      box-shadow: none;
    }
  }

  .apos-button--no-border {
    border: none;
  }

  .apos-button--no-motion {
    &:hover:not([disabled]),
    &:focus:not([disabled]) {
      transform: none;
      box-shadow: none;
      outline: none;
    }
  }

  @keyframes animateGradient {
    0% {
      background-position: 0% 50%;
    }
    50% {
      background-position: 100% 50%;
    }
    100% {
      background-position: 0% 50%;
    }
  }
</style>
