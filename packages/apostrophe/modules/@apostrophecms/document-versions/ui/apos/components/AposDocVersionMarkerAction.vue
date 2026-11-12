<template>
  <button
    v-apos-tooltip="'apostrophe:versionSeeChanges'"
    type="button"
    class="apos-doc-version-marker-action"
  >
    <AposDocVersionAiBadge
      v-if="ai"
      :ai="ai"
    />
    <AposDocVersionChangeType
      v-for="type in types"
      :key="type"
      :type="type"
    />
    <!-- Named by its badges, then its action: an aria-label would hide the
    badges' words from the accessible name (WCAG 2.5.3, Label in Name) -->
    <span class="apos-sr-only">{{ $t('apostrophe:versionSeeChanges') }}</span>
  </button>
</template>

<script setup>
// The badges of a change marker in the versions modal's body, a widget's
// or a field's, as the button that shows the changes behind it
defineProps({
  // `added`, `modified` or `deleted`, then `moved`
  types: {
    type: Array,
    required: true
  },
  // AI's part in the changes, `changed` or `assisted` (see the AI badge);
  // `false` when AI had none
  ai: {
    type: [ String, Boolean ],
    default: false
  }
});
</script>

<style lang="scss" scoped>
.apos-doc-version-marker-action {
  display: flex;
  gap: $spacing-half;
  margin: 0;
  padding: 0;
  border: 0;
  background: none;
  cursor: pointer;
  // The versions modal blocks the pointer over its body
  pointer-events: auto;

  &:focus-visible {
    border-radius: var(--a-border-radius);
    outline: 2px solid var(--a-primary);
    outline-offset: 2px;
  }
}
</style>
