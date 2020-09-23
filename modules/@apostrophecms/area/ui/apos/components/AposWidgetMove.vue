<template>
  <div class="apos-widget-controls apos-widget-move">
    <AposButtonGroup direction="vertical">
      <AposButton
        v-bind="upButton"
        :disabled="first"
        @click="up"
      />
      <AposButton v-bind="dragButton" />
      <AposButton
        v-bind="downButton"
        :disabled="last"
        @click="down"
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
  emits: [ 'up', 'down' ],
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
    dragButton() {
      return {
        ...this.buttonDefaults,
        label: 'Drag',
        icon: 'drag-icon'
      };
    }
  },
  methods: {
    up() {
      this.$emit('up');
    },
    down() {
      this.$emit('down');
    }
  }
};
</script>

<style lang="scss" scoped>
  .apos-widget-move {
    // TODO use this to position button group
  }
</style>
