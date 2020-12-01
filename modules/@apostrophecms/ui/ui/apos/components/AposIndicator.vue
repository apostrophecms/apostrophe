<template>
  <span
    class="apos-indicator"
    v-tooltip="tooltipFinal"
    :style="`height: ${iconSize}px`"
  >
    <component
      :is="icon"
      :size="iconSize"
      class="apos-indicator__icon"
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
      required: true
    },
    iconSize: {
      type: Number,
      default: 15
    },
    tooltip: {
      type: [ String, Object ],
      default: null
    }
  },
  computed: {
    tooltipFinal() {
      let tooltip = {
        delay: {
          show: 500,
          hide: 100
        }
      };
      if (typeof this.tooltip === 'string') {
        tooltip.content = this.tooltip;
      } else {
        tooltip = {
          ...tooltip,
          ...this.tooltip
        };
      }
      return tooltip;
    }
  }
};
</script>
<style lang="scss" scoped>
  .apos-indicator {
    display: inline-flex;
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
