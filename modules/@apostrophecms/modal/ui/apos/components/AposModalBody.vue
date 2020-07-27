<template>
  <div class="apos-modal__body">
    <div class="apos-modal__body-inner">
      <div v-if="hasHeader" class="apos-modal__body-header">
        <slot name="bodyHeader" />
      </div>
      <div class="apos-modal__body-main">
        <slot name="bodyMain" />
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'AposModalBody',
  computed: {
    hasHeader() {
      return !!this.$slots.bodyHeader;
    }
  }
};
</script>

<style lang="scss" scoped>
  .apos-modal__body {
    overflow-y: auto;
    padding: 20px;
  }

  .apos-modal__main--no-rails .apos-modal__body {
    padding: 20px;
  }

  .apos-modal__body-header {
    margin-bottom: 20px;
  }

  // TODO responsibilty of this setting might change
  .apos-modal__body-main .apos-field {
    margin-bottom: 40px;
  }
</style>
