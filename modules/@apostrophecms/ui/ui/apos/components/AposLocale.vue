<template>
  <div class="apos-locale">
    <span class="apos-locale__label">
      {{ $t('apostrophe:locale') }}:
    </span> <span class="apos-locale__label-name">
      {{ props.locale }}
    </span>
  </div>
</template>

<script setup>
const props = defineProps({
  locale: {
    type: String,
    required: true
  }
});
</script>

<style lang="scss" scoped>
  .apos-locale {
    @include type-base;

    font-weight: var(--a-weight-bold);
  }

  .apos-locale__label-name {
    color: var(--a-primary);
  }
</style>
