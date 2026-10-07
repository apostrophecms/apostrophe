<template>
  <div
    class="apos-doc-versions-panel"
    :class="{ 'apos-doc-versions-panel--changes': view === 'changes' }"
    data-apos-test="doc-versions-panel"
  >
    <div class="apos-doc-versions-panel__track">
      <div
        class="apos-doc-versions-panel__pane apos-doc-versions-panel__pane--list"
        data-apos-test="doc-versions-panel-list"
        :inert="view !== 'list' || undefined"
      >
        <slot name="list" />
      </div>
      <div
        class="apos-doc-versions-panel__pane apos-doc-versions-panel__pane--changes"
        data-apos-test="doc-versions-panel-changes"
        :inert="view !== 'changes' || undefined"
      >
        <slot name="changes" />
      </div>
    </div>
  </div>
</template>

<script setup>
// The right-hand panel of the versions modal: the version list, or one
// version's change list slid in over it. Each pane scrolls on its own; the
// pane out of view is inert so it takes no focus.
defineProps({
  view: {
    type: String,
    default: 'list',
    validator: value => [ 'list', 'changes' ].includes(value)
  }
});
</script>

<style lang="scss" scoped>
// `clip`, not `hidden`: focus moving inside the track would scroll it
// sideways otherwise
.apos-doc-versions-panel {
  overflow: clip;
  height: 100%;

  &__track {
    display: flex;
    width: 200%;
    height: 100%;
    transition: transform 200ms cubic-bezier(0.23, 1, 0.32, 1);
    transform: translateX(0);
  }

  &--changes &__track {
    transform: translateX(-50%);
  }

  &__pane {
    overflow-y: auto;
    width: 50%;
    min-width: 0;
    height: 100%;
  }
}
</style>
