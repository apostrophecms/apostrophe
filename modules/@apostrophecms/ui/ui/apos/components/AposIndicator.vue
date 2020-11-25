<template>
  <span
    class="apos-indicator"
    v-tooltip="tooltip"
    :style="`height: ${iconSize}px`"
  >
    <component
      :size="iconSize" class="apos-indicator__icon"
      v-if="icon" :is="icon"
      fill-color="currentColor"
    />
  </span>
</template>

<script>

export default {
  name: 'AposIndicator',
  props: {
    icon: {
      type: String,
      default: null
    },
    iconSize: {
      type: Number,
      default: 15
    },
    tooltip: {
      type: [ String, Object, Boolean ],
      default: false
    }
  }
};
</script>
<style lang="scss" scoped>
  .apos-indicator {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .apos-indicator__icon {
    display: flex;
    max-width: 100%;
    max-height: 100%;
    /deep/ .material-design-icon__svg {
      max-width: 100%;
      max-height: 100%;
    }
  }
</style>
