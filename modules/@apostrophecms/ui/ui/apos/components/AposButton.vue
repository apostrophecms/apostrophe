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
  >
    <transition name="fade">
      <AposSpinner :color="spinnerColor" v-if="busy" />
    </transition>
    <div class="apos-button__content">
      <component
        :size="iconSize" class="apos-button__icon"
        v-if="icon" :is="icon"
        fill-color="currentColor"
      />
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
