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
      />
      <!-- TODO later -->
      <!-- <AposButton v-bind="dragButton" /> -->
      <AposButton
        v-bind="editButton"
        :disabled="disabled"
        v-if="!foreign && !options.contextual"
        @click="$emit('edit')"
      />
      <AposButton
        v-if="!foreign"
        :disabled="disabled || maxReached"
        v-bind="cloneButton"
        @click="$emit('clone')"
      />
      <AposButton
        v-if="!foreign"
        :disabled="disabled"
        v-bind="removeButton"
        @click="$emit('remove')"
      />
      <AposButton
        v-if="!foreign"
        v-bind="downButton"
        :disabled="last || disabled"
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
    }
  },
  emits: [ 'remove', 'edit', 'clone', 'up', 'down' ],
  data() {
    return {
      buttonDefaults: {
        iconOnly: true,
        icon: 'plus-icon',
        type: 'group',
        modifiers: [ 'tiny' ],
        role: 'menuitem'
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
        icon: 'chevron-up-icon'
      };
    },
    downButton() {
      return {
        ...this.buttonDefaults,
        label: 'Nudge down',
        icon: 'chevron-down-icon'
      };
    },
    // dragButton() {
    //   return {
    //     ...this.buttonDefaults,
    //     label: 'Drag',
    //     icon: 'drag-icon'
    //   };
    // },
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
        icon: 'delete-icon'
      };
    },
    editButton() {
      return {
        ...this.buttonDefaults,
        label: 'Edit',
        icon: 'pencil-icon'
      };
    }
  }
};
</script>
