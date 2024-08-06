<template>
  <div class="apos-area-modify-controls">
    <AposButtonGroup
      :modifiers="[ 'vertical' ]"
    >
      <AposButton
        v-if="!foreign"
        v-bind="upButton"
        :disabled="first || disabled"
        :tooltip="{
          content: (!disabled && !first) ? 'apostrophe:nudgeUp' : null,
          placement: 'left'
        }"
        @click="$emit('up')"
      />
      <AposButton
        v-if="!foreign && !options.contextual"
        v-bind="editButton"
        :disabled="disabled"
        :tooltip="{
          content: 'apostrophe:editWidget',
          placement: 'left'
        }"
        @click="$emit('edit')"
      />
      <AposButton
        v-if="!foreign"
        v-bind="cutButton"
        :tooltip="{
          content: 'apostrophe:cut',
          placement: 'left'
        }"
        @click="$emit('cut')"
      />
      <AposButton
        v-if="!foreign"
        v-bind="copyButton"
        :tooltip="{
          content: 'apostrophe:copy',
          placement: 'left'
        }"
        @click="$emit('copy')"
      />
      <AposButton
        v-if="!foreign"
        v-bind="cloneButton"
        :disabled="disabled || maxReached"
        :tooltip="{
          content: 'apostrophe:duplicate',
          placement: 'left'
        }"
        @click="$emit('clone')"
      />
      <AposButton
        v-if="!foreign"
        v-bind="removeButton"
        :disabled="disabled"
        :tooltip="{
          content: 'apostrophe:delete',
          placement: 'left'
        }"
        @click="$emit('remove')"
      />
      <AposButton
        v-if="!foreign"
        v-bind="downButton"
        :disabled="last || disabled"
        :tooltip="{
          content: (!disabled && !last) ? 'apostrophe:nudgeDown' : null,
          placement: 'left'
        }"
        @click="$emit('down')"
      />
    </AposButtonGroup>
  </div>
</template>

<script>

export default {
  props: {
    first: {
      type: Boolean,
      required: true
    },
    last: {
      type: Boolean,
      required: true
    },
    options: {
      type: Object,
      default() {
        return {};
      }
    },
    foreign: {
      type: Boolean,
      required: true
    },
    disabled: {
      type: Boolean,
      default: false
    },
    maxReached: {
      type: Boolean,
      default: false
    },
    tabbable: {
      type: Boolean,
      default: false
    }
  },
  emits: [ 'remove', 'edit', 'cut', 'copy', 'clone', 'up', 'down' ],
  computed: {
    buttonDefaults() {
      return {
        iconOnly: true,
        icon: 'plus-icon',
        type: 'group',
        modifiers: [ 'small', 'inline' ],
        role: 'menuitem',
        class: 'apos-area-modify-controls__button',
        iconSize: 16,
        disableFocus: !this.tabbable
      };
    },
    upButton() {
      return {
        ...this.buttonDefaults,
        label: 'apostrophe:nudgeUp',
        icon: 'arrow-up-icon'
      };
    },
    downButton() {
      return {
        ...this.buttonDefaults,
        label: 'apostrophe:nudgeDown',
        icon: 'arrow-down-icon'
      };
    },
    cloneButton() {
      return {
        ...this.buttonDefaults,
        label: 'apostrophe:clone',
        icon: 'content-copy-icon'
      };
    },
    removeButton() {
      return {
        ...this.buttonDefaults,
        label: 'apostrophe:remove',
        icon: 'trash-can-outline-icon'
      };
    },
    editButton() {
      return {
        ...this.buttonDefaults,
        label: 'apostrophe:edit',
        icon: 'pencil-icon'
      };
    },
    cutButton() {
      return {
        ...this.buttonDefaults,
        label: 'apostrophe:cut',
        icon: 'content-cut-icon'
      };
    },
    copyButton() {
      return {
        ...this.buttonDefaults,
        label: 'apostrophe:copy',
        icon: 'clipboard-plus-outline-icon'
      };
    }
  }
};
</script>

<style lang="scss" scoped>
$z-index-button-background: 1;
$z-index-button-foreground: 2;

.apos-area-modify-controls {
  :deep(.apos-button__content) {
    z-index: $z-index-button-foreground;
    position: relative;
  }

  :deep(.apos-button__icon) {
    transition: all 300ms var(--a-transition-timing-bounce);
  }

  :deep(.apos-button) {
    background-color: transparent;

    &:not([disabled]):hover::after {
      background-color: var(--a-base-9);
    }

    &:active {
      background-color: transparent;
    }

    &:active .apos-button__icon {
      transform: scale(0.8);
    }

    &:active::after, &:focus::after {
      background-color: var(--a-primary-transparent-25);
    }

    &::after,
    &:not([disabled]):hover::after,
    &:not([disabled]):active::after,
    &:not([disabled]):focus::after {
      opacity: 1;
      transform: scale(1.15) translateY(0);
    }

    &::after {
      content: '';
      z-index: $z-index-button-background;
      position: absolute;
      top: 0;
      left: 0;
      display: block;
      width: 100%;
      height: 100%;
      background-color: transparent;
      transition:
        opacity 500ms var(--a-transition-timing-bounce),
        transform 500ms var(--a-transition-timing-bounce),
        background-color 500ms ease;
      opacity: 0;
      transform: scale(0.3) translateY(-4px);
    }
  }
}
</style>
