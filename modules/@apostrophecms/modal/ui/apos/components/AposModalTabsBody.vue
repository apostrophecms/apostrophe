<template>
  <div class="apos-modal-tabs">
    <div class="apos-modal-tabs__wrapper">
      <div class="apos-modal-tabs__pane">
        <slot />
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'AposModalTabsBody'
};
</script>

<style lang="scss" scoped>
.apos-modal-tabs {
  display: flex;
  height: 100%;
}

.apos-modal-tabs__wrapper {
  display: flex;
  flex-grow: 1;
}

.apos-modal-tabs__pane {
  width: 100%;
  border-width: 0;
}
</style>
