<template>
  <span
    v-apos-tooltip="tooltip"
    class="apos-button__wrapper"
    :class="{ 'apos-button__wrapper--block': modifiers.includes('block') }"
    :data-apos-test="actionTestLabel"
  >
    <component
      v-bind="attrs"
      :is="href ? 'a' : 'button'"
      :id="attrs.id ? attrs.id : id"
      ref="buttonTrigger"
      :target="target"
      :href="href"
      class="apos-button"
      :class="modifierClass"
      :tabindex="tabindex"
      :disabled="isDisabled ? isDisabled : null"
      :type="buttonType"
      :role="role"
      :style="{color: textColor}"
      v-on="href ? {} : {click: click}"
    >
      <transition name="fade">
        <AposSpinner v-if="busy" :color="spinnerColor" />
      </transition>
      <span
        v-if="colorStyle"
        class="apos-button__color-preview"
      >
        <span :style="colorStyle" class="apos-button__color-preview__swatch" />
        <span class="apos-button__color-preview__checkerboard" />
      </span>
      <div class="apos-button__content">
        <AposIndicator
          v-if="icon"
          class="apos-button__icon"
          :icon="icon"
          :icon-size="iconSize"
          :icon-color="iconFill"
          @icon="$emit('icon', $event)"
        />
        <slot name="label">
          <span class="apos-button__label" :class="{ 'apos-sr-only' : (iconOnly || type === 'color') }">
            {{ $t(label, interpolate) }}
          </span>
        </slot>
        <AposIndicator
          v-if="secondIcon"
          class="apos-button__second-icon"
          :icon="secondIcon"
          :icon-size="iconSize"
          :icon-color="iconFill"
        />
      </div>
    </component>
  </span>
</template>

<script>
import { createId } from '@paralleldrive/cuid2';

export default {
  name: 'AposButton',
  props: {
    label: {
      type: [ String, Object ],
      default: 'apostrophe:provideButtonLabel'
    },
    action: {
      type: String,
      default: null
    },
    interpolate: {
      type: Object,
      default() {
        return {};
      }
    },
    modifiers: {
      type: Array,
      default() {
        return [];
      }
    },
    color: {
      type: String,
      default: null
    },
    textColor: {
      type: String,
      default: null
    },
    href: {
      type: String,
      default: null
    },
    iconSize: {
      type: Number,
      default: 15
    },
    iconFill: {
      type: String,
      default: 'currentColor'
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
    attrs: {
      type: Object,
      default() {
        return {};
      }
    },
    disableFocus: Boolean,
    buttonType: {
      type: String,
      default: null
    },
    role: {
      type: String,
      default: null
    },
    tooltip: {
      type: [ String, Object, Boolean ],
      default: false
    },
    target: {
      type: String,
      default: null
    },
    secondIcon: {
      type: String,
      default: null
    }
  },
  emits: [ 'click', 'icon' ],
  data() {
    return {
      id: createId()
    };
  },
  computed: {
    tabindex() {
      return this.disableFocus ? '-1' : '0';
    },
    colorStyle() {
      if (this.type === 'color') {
        // if color exists, use it
        if (this.color) {

          let color = this.color;

          if (color.startsWith('--')) {
            color = `var(${color})`;
          }

          return {
            backgroundColor: color
          };
        // if not provide a default placeholder
        } else {
          return {
            backgroundColor: 'transparent'
          };
        }
      } else {
        return null;
      }
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
          modifiers.push(`apos-is-${state}`);
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
      return (this.disabled || this.busy) || null;
    },
    actionTestLabel() {
      return this.action
        ? `${this.action}Trigger`
        : false;
    }
  },
  methods: {
    click($event) {
      this.$emit('click', $event);
    },
    focus() {
      (this.$refs.buttonTrigger?.$el ?? this.$refs.buttonTrigger)?.focus();
    }
  }
};
</script>
<style lang="scss" scoped>
  .apos-button {
    @include type-base;

    & {
      position: relative;
      display: inline-block;
      overflow: hidden;
      padding: 10px 20px;
      border: 1px solid var(--a-base-5);
      color: var(--a-text-primary);
      border-radius: var(--a-border-radius);
      background-color: var(--a-base-9);
      transition: all 200ms ease;
      text-decoration: none;
    }

    &:hover {
      cursor: pointer;
      background-color: var(--a-base-8);
    }

    &:active,
    &.apos-is-active {
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

    &[disabled],
    &.apos-button--disabled {
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
      inset: 0;
      margin: auto;
    }

    .apos-spinner.fade-enter-active, .fade-leave-active {
      transition: all 200ms ease;
    }

    .apos-spinner.fade-enter, .fade-leave-to {
      opacity: 0;
    }
  }

  .apos-button--outline,
  .apos-button[disabled].apos-button--outline {
    background-color: transparent;
  }

  .apos-button.apos-button--color {
    width: 50px;
    height: 50px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    box-shadow: var(--a-box-shadow);
  }

  .apos-button__color-preview {
    width: 100%;
    height: 100%;
  }

  .apos-button__color-preview,
  .apos-button__color-preview__swatch,
  .apos-button__color-preview__checkerboard {
    position: absolute;
    top: 0;
    left: 0;
    border-radius: 50%;
  }

  .apos-button__color-preview__swatch,
  .apos-button__color-preview__checkerboard {
    width: 100%;
    height: 100%;
  }

  .apos-button__color-preview__swatch {
    z-index: $z-index-default;
  }

  .apos-button__color-preview__checkerboard {
    z-index: $z-index-base;
    background-image: url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAMElEQVQ4T2N89uzZfwY8QFJSEp80A+OoAcMiDP7//483HTx//hx/Ohg1gIFx6IcBALl+VXknOCvFAAAAAElFTkSuQmCC');
  }

  .apos-button--small {
    padding: 7.5px 10px;
  }

  .apos-button--quiet,
  .apos-button--subtle {
    padding: 0;
    border: none;
    color: var(--a-primary);
    background-color: transparent;

    &:hover,
    &:active,
    &.apos-is-active,
    &:focus {
      background-color: transparent;
      text-decoration: underline;
      color: var(--a-primary-dark-10);
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

    .apos-button__label {
      line-height: var(--a-line-tall);
    }
  }

  .apos-button--subtle {
    padding: 11px 10px; // extra pixel keeps them aligned with border'd buttons
    color: var(--a-text-primary);

    &:hover,
    &:focus,
    &:active {
      color: var(--a-text-primary);
      text-decoration: none;
      background-color: var(--a-base-10);
    }

    &:focus {
      outline: 1px solid var(--a-base-7);
    }
  }

  .apos-button--gradient-on-hover {
    z-index: $z-index-base;

    &::after {
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
      transition: all 300ms ease;
    }

    &:hover::after {
      opacity: 0.4;
    }

    &[disabled].apos-button--busy::after {
      background-size: 400% 400%;
      opacity: 1;
    }
    // extra strength :sweat-smile:
    &.apos-button[disabled].apos-button--busy {
      border: none;
    }

    &[disabled].apos-button--busy::after {
      animation: animate-gradient 10000ms ease-in-out infinite;
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
    box-sizing: border-box;
    width: 100%;
  }

  .apos-button--icon-right {
    .apos-button__content {
      flex-direction: row-reverse;
    }

    .apos-button__icon {
      margin-right: 0;
      margin-left: 5px;
    }

    .apos-button__second-icon {
      margin-right: 5px;
      margin-left: 0;
    }
  }

  .apos-button--outline {
    &:hover {
      background-color: var(--a-base-9);
    }

    &:active,
    &.apos-is-active {
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

  .apos-button--primary {
    border: 1px solid var(--a-primary-dark-10);
    color: var(--a-white);
    background: var(--a-primary);

    &:hover {
      background-color: var(--a-primary-dark-10);
    }

    &:active,
    &.apos-is-active {
      background-color: var(--a-primary-dark-15);
    }

    &:focus {
      box-shadow: 0 0 0 1px var(--a-base-7),
        0 0 0 3px var(--a-primary-light-40);
    }

    &[disabled],
    &.apos-button--disabled {
      border: 1px solid var(--a-primary-light-40);
      color: var(--a-white);
      background-color: var(--a-primary-light-40);
    }

    &[disabled].apos-button--busy {
      border: 1px solid var(--a-primary-light-40);
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
    &.apos-is-active {
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
    &.apos-is-active {
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

    &.apos-button--inline {
      color: var(--a-danger-button-active);
    }

    .apos-spinner__svg {
      color: var(--a-danger);
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

  .apos-button--icon.apos-button--small {
    padding: 7.5px 10px;
  }

  .apos-button--icon-only.apos-button--small {
    padding: 7.5px;
  }

  .apos-button__label {
    display: inline-block;
  }

  .apos-button__content {
    display: flex;
    align-items: center;
    justify-content: center;
    transition: opacity 200ms ease;
  }

  .apos-button__icon {
    display: inline-flex;
    align-items: center;
  }

  .apos-button__icon {
    margin-right: 5px;
  }

  .apos-button__second-icon {
    margin-left: 5px;
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

  .apos-button--uppercase .apos-button__label {
    text-transform: uppercase;
  }

  .apos-button--inline {
    padding: 0;

    &, &[disabled], &:hover, &:active, &:focus {
      border: 0;
      background-color: transparent;
      box-shadow: none;
    }
  }

  .apos-button--no-border {
    &,
    &:focus,
    &:active,
    &:hover {
      border: none;
    }
  }

  .apos-button--no-motion {
    &:hover:not([disabled]),
    &:focus:not([disabled]) {
      transform: none;
      box-shadow: none;
    }
  }

  .apos-button__wrapper {
    display: inline-block;
  }

  .apos-button__wrapper--block {
    display: block;
  }

  @keyframes animate-gradient {
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
