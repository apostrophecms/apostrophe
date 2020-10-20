<template>
  <div class="apos-area-modify-controls">
    <AposButtonGroup direction="vertical">
      <AposButton
        v-bind="upButton"
        :disabled="first"
        @click="$emit('up')"
      />
      <!-- TODO later -->
      <!-- <AposButton v-bind="dragButton" /> -->
      <AposButton
        v-bind="editButton"
        @click="$emit('edit')"
      />
      <AposButton
        v-bind="cloneButton"
        @click="$emit('clone')"
      />
      <AposButton
        v-bind="removeButton"
        @click="$emit('remove')"
      />
      <AposButton
        v-bind="downButton"
        :disabled="last"
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
