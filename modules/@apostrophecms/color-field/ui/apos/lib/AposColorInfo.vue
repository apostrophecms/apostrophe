<template>
  <div class="apos-color-info" data-apos-test="colorInfo">
    <span v-if="!isMicro && label">
      {{ label }}
    </span>
    <AposButton
      v-if="!isMicro"
      type="quiet"
      :label="'apostrophe:clear'"
      class="apos-color-info__clear-btn"
      :modifiers="['no-motion']"
      @click="emit('clear')"
    />
    <AposIndicator
      v-else
      class="apos-color-info__clear-icon"
      icon="water-off-icon"
      @click="emit('clear')"
    />
  </div>
</template>

<script setup>
defineProps({
  isMicro: {
    type: Boolean,
    default: false
  },
  label: {
    type: String,
    default: null
  }
});

const emit = defineEmits([ 'clear' ]);
</script>

<style lang="scss">
  .apos-color-info {
    @include type-base;

    & {
      color: var(--a-text-primary);
    }
  }

  .apos-color-info__clear-btn {
    margin-left: 10px;
  }

  .apos-color-info__clear-icon {
    cursor: pointer;
    color: var(--a-base-2);

    &:hover {
      color: var(--a-primary);
    }
  }
</style>
