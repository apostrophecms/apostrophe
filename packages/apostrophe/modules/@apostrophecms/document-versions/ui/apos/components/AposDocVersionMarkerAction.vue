<template>
  <button
    v-apos-tooltip="'apostrophe:versionSeeChanges'"
    type="button"
    class="apos-doc-version-marker-action"
    :aria-label="$t('apostrophe:versionSeeChanges')"
  >
    <AposDocVersionAiBadge v-if="ai" />
    <AposDocVersionChangeType
      v-for="type in types"
      :key="type"
      :type="type"
    />
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
  // Whether AI was involved
  ai: {
    type: Boolean,
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
