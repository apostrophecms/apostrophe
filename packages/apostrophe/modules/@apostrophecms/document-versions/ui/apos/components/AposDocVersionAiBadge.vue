<template>
  <span
    class="apos-doc-version-ai-badge"
    data-apos-test="doc-version-ai-badge"
  >
    {{ $t('apostrophe:versionChangeAi') }}
  </span>
</template>

<script setup>
// Says AI was involved in the change it stands before
</script>

<style lang="scss" scoped>
.apos-doc-version-ai-badge {
  display: inline-block;
  box-sizing: border-box;
  padding: 2px 6px;
  border: 1px solid color-mix(in srgb, currentcolor 50%, transparent);
  border-radius: var(--a-border-radius);
  background-color: var(--a-primary-light-80);
  color: var(--a-primary-dark-15);
  font-family: var(--a-family-default);
  font-size: var(--a-type-tiny);
  font-weight: var(--a-weight-bold);
  letter-spacing: 0.2px;
  line-height: 1.5;
  white-space: nowrap;
}
</style>
