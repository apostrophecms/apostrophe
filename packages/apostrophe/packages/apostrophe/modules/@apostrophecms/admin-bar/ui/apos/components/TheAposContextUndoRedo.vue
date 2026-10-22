<template>
  <transition-group
    tag="div"
    class="apos-admin-bar__control-set apos-admin-bar__control-set--context-controls"
    name="flip"
  >
    <!-- need a tooltip even on a disabled button -->
    <div
      :key="'undo'"
      v-apos-tooltip="undoTooltips.undo"
    >
      <AposButton
        :disabled="!canUndo"
        type="subtle"
        :modifiers="['small', 'no-motion']"
        label="apostrophe:undo"
        class="apos-admin-bar__context-button"
        icon="undo-icon"
        :icon-only="true"
        @click="undo"
      />
    </div>
    <div
      :key="'redo'"
      v-apos-tooltip="undoTooltips.redo"
    >
      <AposButton
        :disabled="!canRedo"
        type="subtle"
        :modifiers="['small', 'no-motion']"
        label="apostrophe:redo"
        class="apos-admin-bar__context-button"
        icon="redo-icon"
        :icon-only="true"
        @click="redo"
      />
    </div>
  </transition-group>
</template>

<script>

export default {
  name: 'TheAposContextUndoRedo',
  props: {
    canUndo: Boolean,
    canRedo: Boolean
  },
  emits: [ 'undo', 'redo' ],
  computed: {
    undoTooltips() {
      const tooltips = {
        undo: 'apostrophe:undoTooltip',
        redo: 'apostrophe:redoTooltip'
      };

      if (!this.canUndo) {
        tooltips.undo = 'apostrophe:undoTooltipNoChanges';
      }

      if (!this.canRedo) {
        tooltips.redo = 'apostrophe:redoTooltipNoChanges';
      }

      return tooltips;
    }
  },
  mounted() {
    apos.bus.$on('command-menu-admin-bar-undo', this.undo);
    apos.bus.$on('command-menu-admin-bar-redo', this.redo);
  },
  unmounted() {
    apos.bus.$off('command-menu-admin-bar-undo', this.undo);
    apos.bus.$off('command-menu-admin-bar-redo', this.redo);
  },
  methods: {
    undo() {
      if (this.canUndo) {
        this.$emit('undo');
      }
    },
    redo() {
      if (this.canRedo) {
        this.$emit('redo');
      }
    }
  }
};
</script>
<style lang="scss" scoped>
  .apos-admin-bar__control-set--context-controls {
    border-right: 1px solid var(--a-base-9);
  }

  :deep(.apos-admin-bar__context-button.apos-button__wrapper) {
    display: flex;
  }
</style>
