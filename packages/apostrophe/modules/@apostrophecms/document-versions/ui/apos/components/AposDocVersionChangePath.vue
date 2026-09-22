<template>
  <span class="apos-doc-version-change-path">
    <template
      v-for="(segment, index) in segments"
      :key="index"
    >
      <chevron-right-icon
        v-if="index"
        :size="12"
        class="apos-doc-version-change-path__icon"
        aria-hidden="true"
      />
      <span
        v-if="index"
        class="apos-sr-only"
      >, </span>
      <span
        class="apos-doc-version-change-path__crumb"
      >{{ segmentText(segment) }}</span>
    </template>
  </span>
</template>

<script setup>
// A breadcrumb of change path segments, read as a comma list
import { inject } from 'vue';

defineProps({
  // Path segments of the `changes` route
  segments: {
    type: Array,
    required: true
  }
});

const $t = inject('i18n');

function segmentText(segment) {
  const label = $t(segment.label);
  return segment.title ? `${label} · ${segment.title}` : label;
}
</script>

<style lang="scss" scoped>
.apos-doc-version-change-path {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px;
  min-width: 0;

  &__crumb {
    overflow-wrap: anywhere;
  }

  // The icon component offsets its svg below the baseline; it sits in a
  // flex row and centers instead
  &__icon {
    display: flex;
    flex-shrink: 0;
    color: var(--a-base-1);

    :deep(.material-design-icon__svg) {
      bottom: 0;
    }
  }
}
</style>
