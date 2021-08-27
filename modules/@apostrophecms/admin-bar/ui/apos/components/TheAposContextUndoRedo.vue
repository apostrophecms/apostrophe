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
        :disabled="patchesSinceLoaded.length === 0"
        type="subtle" :modifiers="['small', 'no-motion']"
        label="apostrophe:undo" class="apos-admin-bar__context-button"
        icon="undo-icon" :icon-only="true"
        @click="undo"
      />
    </div>
    <div
      :key="'redo'"
      v-apos-tooltip="undoTooltips.redo"
    >
      <AposButton
        :disabled="undone.length === 0"
        type="subtle" :modifiers="['small', 'no-motion']"
        label="apostrophe:redo" class="apos-admin-bar__context-button"
        icon="redo-icon" :icon-only="true"
        @click="redo"
      />
    </div>
    <TheAposSavingIndicator
      :key="'status'"
      :retrying="retrying"
      :editing="editing"
      :saving="saving"
      :saved="saved"
    />
  </transition-group>
</template>

<script>

export default {
  name: 'TheAposContextUndoRedo',
  props: {
    patchesSinceLoaded: {
      type: Array,
      default() {
        return [];
      }
    },
    undone: {
      type: Array,
      default() {
        return [];
      }
    },
    retrying: Boolean,
    editing: Boolean,
    saving: Boolean,
    saved: Boolean
  },
  emits: [ 'undo', 'redo' ],
  computed: {
    undoTooltips() {
      const tooltips = {
        undo: 'apostrophe:undoTooltip',
        redo: 'apostrophe:redoTooltip'
      };

      if (this.patchesSinceLoaded.length === 0) {
        tooltips.undo = 'apostrophe:undoTooltipNoChanges';
      }

      if (this.undone.length === 0) {
        tooltips.redo = 'apostrophe:redoTooltipNoChanges';
      }

      return tooltips;
    }
  },
  methods: {
    undo() {
      this.$emit('undo');
    },
    redo() {
      this.$emit('redo');
    }
  }
};
</script>
<style lang="scss" scoped>
  ::v-deep .apos-admin-bar__context-button.apos-button__wrapper {
    display: flex;
  }
</style>
