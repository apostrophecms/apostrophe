<template>
  <div class="apos-modal__rail" :class="`apos-modal__rail--${type}`">
    <slot />
  </div>
</template>
<script>
export default {
  name: 'AposModalRail',
  props: {
    type: {
      type: String,
      default: 'left'
    }
  },
  computed: {

  }
};
</script>

<style lang="scss" scoped>
  .apos-modal__rail {
    overflow-y: auto;
    background-color: var(--a-base-10);
  }

</style>
