<template>
  <span
    class="apos-doc-version-ai-badge"
    :class="{
      'apos-doc-version-ai-badge--assisted': ai === 'assisted',
      'apos-doc-version-ai-badge--subtle': subtle
    }"
    data-apos-test="doc-version-ai-badge"
  >
    {{ $t(ai === 'assisted'
      ? 'apostrophe:versionChangeAiAssisted'
      : 'apostrophe:versionChangeAi') }}
  </span>
</template>

<script setup>
// Says AI had a part in the change it stands before
defineProps({
  // AI's part: `changed` when AI made the change, `assisted` when a person
  // made it after AI worked on it
  ai: {
    type: String,
    default: 'changed'
  },
  // Plain text rather than a badge, for a line of text it follows
  subtle: {
    type: Boolean,
    default: false
  }
});
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

// Outlined: the background of the admin UI, opaque, since the badge also
// sits over the page in the preview
.apos-doc-version-ai-badge--assisted {
  background-color: var(--a-background-primary);
}

.apos-doc-version-ai-badge--subtle {
  padding: 0;
  border: 0;
  background-color: transparent;
  color: var(--a-base-2);
  font-size: var(--a-type-smaller);
  font-weight: var(--a-weight-base);
  letter-spacing: 0;
  line-height: inherit;
}
</style>
