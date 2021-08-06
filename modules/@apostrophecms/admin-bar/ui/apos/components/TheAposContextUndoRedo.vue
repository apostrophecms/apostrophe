<template>
  <transition-group
    tag="div"
    class="apos-admin-bar__control-set apos-admin-bar__control-set--context-controls"
    name="flip"
  >
    <AposButton
      key="undo"
      :tooltip="undoTooltips.undo"
      :disabled="patchesSinceLoaded.length === 0"
      type="subtle" :modifiers="['small', 'no-motion']"
      label="Undo" class="apos-admin-bar__context-button"
      icon="undo-icon" :icon-only="true"
      @click="undo"
    />
    <AposButton
      key="redo"
      :tooltip="undoTooltips.redo"
      :disabled="undone.length === 0"
      type="subtle" :modifiers="['small', 'no-motion']"
      label="Redo" class="apos-admin-bar__context-button"
      icon="redo-icon" :icon-only="true"
      @click="redo"
    />
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
        undo: 'Undo Change',
        redo: 'Redo Change'
      };

      if (this.patchesSinceLoaded.length === 0) {
        tooltips.undo = 'No changes to undo';
      }

      if (this.undone.length === 0) {
        tooltips.redo = 'No changes to redo';
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
