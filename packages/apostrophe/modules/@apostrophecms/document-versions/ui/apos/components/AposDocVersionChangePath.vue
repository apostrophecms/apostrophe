<template>
  <span
    class="apos-doc-version-change-path"
    :class="{ 'apos-doc-version-change-path--compact': compact }"
    :title="compact ? fullPath : undefined"
  >
    <template
      v-for="(item, index) in visibleSegments"
      :key="item.key"
    >
      <chevron-right-icon
        v-if="index"
        :size="12"
        class="apos-doc-version-change-path__icon"
        aria-hidden="true"
      />
      <span
        v-if="index && !isCollapsed"
        class="apos-sr-only"
      >, </span>
      <span
        v-if="item.ellipsis"
        class="apos-doc-version-change-path__ellipsis"
        aria-hidden="true"
      >…</span>
      <span
        v-else
        class="apos-doc-version-change-path__crumb"
        :class="{
          'apos-doc-version-change-path__crumb--leaf':
            index === visibleSegments.length - 1
        }"
        :aria-hidden="isCollapsed ? 'true' : undefined"
      >{{ segmentText(item.segment) }}</span>
    </template>
    <span
      v-if="isCollapsed"
      class="apos-sr-only"
    >{{ fullPath }}</span>
  </span>
</template>

<script setup>
// A breadcrumb of change path segments, read as a comma list
import { computed, inject } from 'vue';

const props = defineProps({
  // Path segments of the `changes` route
  segments: {
    type: Array,
    required: true
  },
  // Keep the root and leaf visible when a row has a deep path
  compact: {
    type: Boolean,
    default: false
  }
});

const $t = inject('i18n');

const isCollapsed = computed(() => props.compact && props.segments.length > 3);
const fullPath = computed(() => props.segments.map(segmentText).join(', '));
const visibleSegments = computed(() => {
  const segments = props.segments.map((segment, index) => ({
    key: index,
    segment
  }));

  if (!isCollapsed.value) {
    return segments;
  }

  return [
    segments[0],
    {
      key: 'ellipsis',
      ellipsis: true
    },
    segments[segments.length - 1]
  ];
});

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

  &--compact {
    overflow: hidden;
    flex-wrap: nowrap;
    width: 100%;
    white-space: nowrap;
  }

  &--compact &__crumb {
    overflow: hidden;
    flex: 0 1 auto;
    min-width: 0;
    text-overflow: ellipsis;
  }

  &--compact &__crumb--leaf {
    flex: 1 1 auto;
  }

  &__ellipsis {
    flex-shrink: 0;
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
