<template>
  <button
    type="button"
    class="apos-recently-edited-filter-tag"
    data-apos-test="recently-edited-tag"
    :data-apos-test-tag="tag.name"
    @click="$emit('clear', tag.name, tag.value)"
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
    padding: 8px 10px;
    border: 1px solid var(--a-base-8);
    border-radius: var(--a-border-radius);
    background-color: var(--a-white);
    white-space: nowrap;
    line-height: 1.1;
  }

  &:hover {
    border-color: var(--a-base-5);

    .apos-recently-edited-filter-tag__close-icon {
      color: var(--a-primary);
    }
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
  text-overflow: ellipsis;
}
</style>
