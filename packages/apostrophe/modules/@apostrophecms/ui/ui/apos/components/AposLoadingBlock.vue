<template>
  <div
    class="apos-loading-block"
    :style="{height: `calc(100% - ${props.topBlockHeight}px)`}"
  >
    <div class="apos-loading-block__content">
      <AposLoading class="apos-loading-block__loader" />
      <span
        v-if="label"
        class="apos-loading-block__text"
      >
        {{ $t(label) }}
      </span>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  topBlockHeight: {
    type: Number,
    default: 0
  },
  label: {
    type: String,
    default: null
  }
});
</script>

<style lang="scss" scoped>
.apos-loading-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-around;
}

.apos-loading-block__content {
  text-align: center;
}

.apos-loading-block__loader {
  width: 80px;
  margin-bottom: 15px;
}

.apos-loading-block__text {
  @include type-base;

  & {
    color: var(--a-base-1);
  }
}
</style>
