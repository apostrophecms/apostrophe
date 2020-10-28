<template>
  <div class="apos-rich-text-editor__control apos-rich-text-editor__control--divider">
    |
  </div>
</template>

<script>

export default {
  name: 'AposTiptapDivider',
  props: {
    name: {
      type: String,
      required: true
    }
  }
};
</script>

<style lang="scss" scoped>
  .apos-rich-text-editor__control--divider {
    @include typeAffordance;
    padding: 0 10px;
    opacity: 0.3;
  }
</style>
