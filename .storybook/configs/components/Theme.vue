<template>
  <div class="sb-theme" :class="theme">
    <slot />
  </div>
</template>

<script>
export default {
  name: 'Theme',
  props: {
    theme: String
  }
};
</script>

<style lang="scss" scoped>
@import '../../../lib/modules/@apostrophecms/ui/scss/_theme';
.sb-theme {
  padding-top: 30px;
  padding-left: 30px;
  height: 100vh;
  .sb-theme {
    padding: 0;
  }
}
.sb-context-rail {
  background-color: var(--a-base-9);
}
</style>
