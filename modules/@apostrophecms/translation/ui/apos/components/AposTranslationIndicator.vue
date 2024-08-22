<template>
  <span
    class="apos-translation-indicator"
    data-apos-test="translationIndicator"
  >
    <svg
      :width="size"
      :height="size"
      viewBox="0 0 24 24"
    >
      <defs>
        <linearGradient
          id="apos-translation-gradient"
          x1="0"
          x2="0"
          y1="0"
          y2="1"
        >
          <stop class="stop1" offset="0%" />
          <stop class="stop2" offset="100%" />
        </linearGradient>
      </defs>
      <path
        id="svg-path"
        d="M19,1L17.74,3.75L15,5L17.74,6.26L19,9L20.25,6.26L23,5L20.25,3.75M9,4L6.5,9.5L1,12L6.5,14.5L9,20L11.5,14.5L17,12L11.5,9.5M19,15L17.74,17.74L15,19L17.74,20.25L19,23L20.25,20.25L23,19L20.25,17.74"
      />
    </svg>
    <p v-if="label" class="apos-translation-indicator__text">
      {{ $t(label) }}
    </p>
  </span>
</template>
<script>

export default {
  name: 'AposTranslationIndicator',
  props: {
    label: {
      type: String,
      default: null
    },
    size: {
      type: Number,
      default: 16
    }
  }
};

</script>

<style lang="scss">
$border: #8EFF92;
$color: #035204;
$background: #F7FEF4;

.apos-translation-indicator {
  display: inline-flex;
  align-items: center;
  padding: 2px;
  border: 1px solid $border;
  border-radius: 6px;
  color: $color;
  background-color: $background;
}

.apos-translation-indicator__text {
  @include type-label;

  & {
    margin: 0 0 0 4px;
    color: $color;
    font-size: var(--a-type-tiny);
  }
}

#svg-path {
  fill: url("#apos-translation-gradient");
}

.stop1 {
  stop-color: $border;
}

.stop2 {
  stop-color: $color;
}
</style>
