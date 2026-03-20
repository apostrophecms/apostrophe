<template>
  <button
    type="button"
    class="apos-recently-edited-filter-tag"
    @click="$emit('clear', tag.name)"
  >
    <close-icon
      class="apos-recently-edited-filter-tag__close-icon"
      :size="10"
      title=""
    />
    <span class="apos-recently-edited-filter-tag__label">
      {{ $t(tag.label) }}
    </span>
    <span class="apos-recently-edited-filter-tag__value">
      {{ tag.valueLabel }}
    </span>
  </button>
</template>

<script setup>
defineProps({
  tag: {
    type: Object,
    required: true
  }
});

defineEmits([ 'clear' ]);
</script>

<style lang="scss" scoped>
.apos-recently-edited-filter-tag {
  @include apos-button-reset();
  @include type-base;

  & {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 10px 12px;
    border: 1px solid var(--a-base-8);
    border-radius: var(--a-border-radius);
    background-color: var(--a-white);
    white-space: nowrap;
  }

  &:hover {
    border-color: var(--a-base-5);
  }
}

.apos-recently-edited-filter-tag__close-icon {
  position: relative;
  top: 1px;
  color: var(--a-base-4);
}

.apos-recently-edited-filter-tag__label {
  color: var(--a-base-4);
}

.apos-recently-edited-filter-tag__value {
  overflow: hidden;
  max-width: 200px;
  font-weight: var(--a-weight-bold);
  text-overflow: ellipsis;
}
</style>
