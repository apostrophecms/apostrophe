<template>
  <transition
    name="collapse"
    :duration="1000"
  >
    <div class="apos-select-box">
      <h3>Select Box !!!</h3>
    </div>
  </transition>
</template>

<script>

export default {
  props: {
    selectedState: {
      type: String,
      required: true
    }
  }
};
</script>
<style lang='scss' scoped>
  .collapse-enter-active, .collapse-leave-active {
    transition: opacity 0.5s;
  }
  .collapse-enter-active {
    opacity: 1;
  }
  .collapse-enter, .collapse-leave-to {
    opacity: 0;
  }

  .apos-select-box {
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    color: var(--a-text-primary);
    background-color: var(--a-base-9);
  }

</style>
