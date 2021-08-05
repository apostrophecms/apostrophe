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
        :tooltip="(!disabled && !first) ? 'Nudge Up' : null"
      />
      <AposButton
        v-bind="editButton"
        :disabled="disabled"
        v-if="!foreign && !options.contextual"
        @click="$emit('edit')"
        tooltip="Edit Widget"
      />
      <AposButton
        v-bind="cutButton"
        v-if="!foreign"
        @click="$emit('cut')"
        tooltip="Cut"
      />
      <AposButton
        v-bind="copyButton"
        v-if="!foreign"
        @click="$emit('copy')"
        tooltip="Copy"
      />
      <AposButton
        v-if="!foreign"
        :disabled="disabled || maxReached"
        v-bind="cloneButton"
        @click="$emit('clone')"
        tooltip="Duplicate"
      />
      <AposButton
        v-if="!foreign"
        :disabled="disabled"
        v-bind="removeButton"
        @click="$emit('remove')"
        tooltip="Delete"
      />
      <AposButton
        v-if="!foreign"
        v-bind="downButton"
        :disabled="last || disabled"
        @click="$emit('down')"
        :tooltip="(!disabled && !last) ? 'Nudge Down' : null"
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
        label: 'Nudge Up',
        icon: 'arrow-up-icon'
      };
    },
    downButton() {
      return {
        ...this.buttonDefaults,
        label: 'Nudge down',
        icon: 'arrow-down-icon'
      };
    },
    cloneButton() {
      return {
        ...this.buttonDefaults,
        label: 'Clone',
        icon: 'content-copy-icon'
      };
    },
    removeButton() {
      return {
        ...this.buttonDefaults,
        label: 'Remove',
        icon: 'trash-can-outline-icon'
      };
    },
    editButton() {
      return {
        ...this.buttonDefaults,
        label: 'Edit',
        icon: 'pencil-icon'
      };
    },
    cutButton() {
      return {
        ...this.buttonDefaults,
        label: 'Cut',
        icon: 'content-cut-icon'
      };
    },
    copyButton() {
      return {
        ...this.buttonDefaults,
        label: 'Copy',
        icon: 'clipboard-plus-outline-icon'
      };
    }
  }
};
</script>
