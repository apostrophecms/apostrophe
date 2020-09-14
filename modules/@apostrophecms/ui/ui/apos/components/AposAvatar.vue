
<template>
  <img
    :src="src" class="apos-avatar"
    :style="{ width: size }" :alt="alt"
  >
</template>

<script>
export default {
  name: 'AposAvatar',
  props: {
    src: {
      type: String,
      required: true
    },
    size: {
      type: String,
      default: null
    },
    alt: {
      type: String,
      default: ''
    }
  }
};
</script>

<style lang="scss" scoped>
  .apos-avatar {
    display: inline-block;
    border-radius: 100%;
    width: 30px;
  }
</style>
