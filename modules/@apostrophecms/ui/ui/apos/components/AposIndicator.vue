<template>
  <span
    class="apos-indicator"
    v-apos-tooltip="tooltip"
    :aria-hidden="decorative"
  >
    <component
      :is="icon"
      :size="iconSize"
      :title="title ? title : ''"
      class="apos-indicator__icon"
      :fill-color="iconColor"
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
      type: [ String, Object, Boolean ],
      default: false
    },
    title: {
      type: [ String, Boolean ],
      default: false
    },
    iconColor: {
      type: String,
      default: 'currentColor'
    },
    decorative: {
      type: Boolean,
      default: true
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
    display: inline-flex;
  }
</style>
