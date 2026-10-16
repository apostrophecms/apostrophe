<template>
  <h3 class="apos-doc-version-changes__group-header">
    <button
      type="button"
      class="apos-doc-version-changes__group-title"
      :aria-current="current ? 'true' : undefined"
      data-apos-test="doc-version-change-group-select"
      @click="$emit('select')"
    >
      <AposDocVersionChangePath
        :segments="group.path"
      />
      <span class="apos-sr-only">{{ `, ${$t('apostrophe:versionNavShow')}` }}</span>
    </button>
    <AposDocVersionChangeType :type="group.type" />
  </h3>
</template>

<script setup>
// The header of a group of changes: its breadcrumb, a button that selects
// the group, and its change type
defineProps({
  // A group of `change-groups.js`
  group: {
    type: Object,
    required: true
  },
  // Whether the navigator is at the group
  current: {
    type: Boolean,
    default: false
  }
});

defineEmits([ 'select' ]);
</script>

<style lang="scss" scoped>
$pad-x: $spacing-base + $spacing-half;

.apos-doc-version-changes {
  &__group-header {
    @include type-base;

    & {
      z-index: $z-index-default;
      position: sticky;
      top: 0;
      display: flex;
      overflow: hidden;
      align-items: center;
      gap: $spacing-base;
      margin: 0;
      padding: $spacing-three-quarters $pad-x;
      border-bottom: 1px solid var(--a-base-7);
      background-color: var(--a-base-9);
    }

    // Same bar as the current group; off-canvas until hover
    &::before {
      content: '';
      position: absolute;
      top: 0;
      bottom: 0;
      left: 0;
      width: 3px;
      background-color: var(--a-primary);
      transform: translateX(-100%);
      transition: transform 200ms cubic-bezier(0.23, 1, 0.32, 1);
    }

    &:hover::before,
    &:focus-within::before {
      transform: translateX(-1px);
    }
  }

  // The group the navigator is at
  &__group--current &__group-header::before {
    transform: translateX(0);
  }

  &__group-title {
    flex: 1 1 auto;
    min-width: 0;
    padding: 0;
    border: 0;
    color: inherit;
    background: none;
    font: inherit;
    text-align: left;
    cursor: pointer;

    &:hover {
      text-decoration: underline;
    }

    &:focus-visible {
      outline: 2px solid var(--a-primary);
      outline-offset: 2px;
    }
  }
}
</style>
