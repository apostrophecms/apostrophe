<template>
  <div class="apos-doc-version-changes__more">
    <AposButton
      class="apos-doc-version-changes__more-toggle"
      type="quiet"
      :label="modelValue
        ? 'apostrophe:versionShowLessText'
        : 'apostrophe:versionShowFullText'"
      :attrs="{
        'aria-pressed': modelValue,
        'data-apos-test': 'doc-version-change-full'
      }"
      @click="emit('update:modelValue', !modelValue)"
    />
  </div>
</template>

<script setup>
// The toggle between the text of a change cut short and in full
defineProps({
  // Whether the text shows in full
  modelValue: {
    type: Boolean,
    required: true
  }
});

const emit = defineEmits([ 'update:modelValue' ]);
</script>

<style lang="scss" scoped>
.apos-doc-version-changes {
  &__more {
    display: flex;
    justify-content: flex-end;
    padding: $spacing-one-quarter $spacing-base;
    border-top: 1px solid var(--a-base-8);
  }

  &__more-toggle :deep(.apos-button) {
    font-size: var(--a-type-smaller);
    transform: none;

    &:hover:not([disabled]),
    &:focus:not([disabled]) {
      transform: none;
    }
  }
}
</style>
