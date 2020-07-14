<template>
  <div :class="className" class="apos-toolbar">
    <div v-if="hasLeftControls" class="apos-toolbar__group apos-toolbar__group--left">
      <slot name="leftControls" />
    </div>
    <div v-if="hasRightControls" class="apos-toolbar__group apos-toolbar__group--right">
      <slot name="rightControls" />
    </div>
  </div>
</template>

<script>

export default {
  props: {
    className: {
      type: String,
      default: ''
    }
  },
  computed: {
    hasLeftControls() {
      return !!this.$slots.leftControls;
    },
    hasRightControls() {
      return !!this.$slots.rightControls;
    }
  }
};
</script>

<style lang="scss" scoped>
  @import 'apostrophe/@apostrophecms/ui/scss/_mixins';
  .apos-toolbar {
    display: flex;
    justify-content: space-between;
  }

  .apos-toolbar__group--left > * {
    margin-right: 7.5px;
  }

  .apos-toolbar__group--right > * {
    margin-left: 7.5px;
  }

  .apos-toolbar__group {
    display: flex;
  }
</style>
