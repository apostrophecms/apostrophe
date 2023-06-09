<template>
  <div class="apos-area-modify-controls">
    <AposButtonGroup
      :modifiers="groupModifiers"
    >
      <AposButton
        v-if="!foreign"
        v-bind="upButton"
        :disabled="first || disabled"
        @click="$emit('up')"
        :tooltip="{
          content: (!disabled && !first) ? 'apostrophe:nudgeUp' : null,
          placement: 'left'
        }"
        :modifiers="[ 'inline' ]"
      />
      <AposButton
        v-bind="editButton"
        :disabled="disabled"
        v-if="!foreign && !options.contextual"
        @click="$emit('edit')"
        :tooltip="{
          content: 'apostrophe:editWidget',
          placement: 'left'
        }"
        :modifiers="[ 'inline' ]"
      />
      <AposButton
        v-bind="cutButton"
        v-if="!foreign"
        @click="$emit('cut')"
        :tooltip="{
          content: 'apostrophe:cut',
          placement: 'left'
        }"
        :modifiers="[ 'inline' ]"
      />
      <!-- <AposButton
        v-bind="copyButton"
        v-if="!foreign"
        @click="$emit('copy')"
        tooltip="Copy"
      /> -->
      <AposButton
        v-if="!foreign"
        :disabled="disabled || maxReached"
        v-bind="cloneButton"
        @click="$emit('clone')"
        :tooltip="{
          content: 'apostrophe:duplicate',
          placement: 'left'
        }"
        :modifiers="[ 'inline' ]"
      />
      <AposButton
        v-if="!foreign"
        :disabled="disabled"
        v-bind="removeButton"
        @click="$emit('remove')"
        :tooltip="{
          content: 'apostrophe:delete',
          placement: 'left'
        }"
        :modifiers="[ 'inline' ]"
      />
      <AposButton
        v-if="!foreign"
        v-bind="downButton"
        :disabled="last || disabled"
        @click="$emit('down')"
        :tooltip="{
          content: (!disabled && !last) ? 'apostrophe:nudgeDown' : null,
          placement: 'left'
        }"
        :modifiers="[ 'inline' ]"
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
    }
  },
  emits: [ 'remove', 'edit', 'cut', 'copy', 'clone', 'up', 'down' ],
  data() {
    return {
      buttonDefaults: {
        iconOnly: true,
        icon: 'plus-icon',
        type: 'group',
        modifiers: [ 'small' ],
        role: 'menuitem',
        class: 'apos-area-modify-controls__button',
        iconSize: 16
      }
    };
  },
  computed: {
    groupModifiers() {
      const mods = [ 'vertical' ];

      if (this.foreign) {
        mods.push('invert');
      }

      return mods;
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
.apos-area-modify-controls {
  box-shadow: var(--a-box-shadow);
}
</style>
