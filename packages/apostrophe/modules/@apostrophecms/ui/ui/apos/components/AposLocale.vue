<template>
  <div class="apos-locale">
    <span class="apos-locale__label">
      {{ $t('apostrophe:locale') }}:
    </span> <span class="apos-locale__label-name">
      {{ locale }}
    </span>
  </div>
</template>

<script setup>
import { computed } from 'vue';
const props = defineProps({
  locale: {
    type: String,
    required: true
  }
});

const locale = computed(() => {
  const label = apos.i18n.locales[props.locale]?.label;
  return label ? `${label} (${props.locale})` : props.locale;
});
</script>

<style lang="scss" scoped>
  .apos-locale {
    @include type-base;

    & {
      font-weight: var(--a-weight-bold);
    }
  }

  .apos-locale__label-name {
    color: var(--a-primary);
  }
</style>
