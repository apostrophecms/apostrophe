<template>
  <div
    class="apos-modal__body"
    :class="{ 'apos-modal__body--flex': hasSlot('footer') }"
  >
    <div class="apos-modal__body-inner">
      <div
        v-if="hasSlot('bodyHeader')"
        ref="bodyHeader"
        class="apos-modal__body-header"
      >
        <slot name="bodyHeader" />
      </div>
      <div
        ref="bodyMain"
        class="apos-modal__body-main"
      >
        <slot name="bodyMain" />
      </div>
    </div>
    <div
      v-if="hasSlot('footer')"
      class="apos-modal__body-footer"
    >
      <slot name="footer" />
    </div>
  </div>
</template>

<script>
export default {
  name: 'AposModalBody',
  data() {
    return {
      headerHeight: 0
    };
  },
  async mounted() {
    if (this.$refs.bodyHeader) {
      await this.$nextTick();
      this.headerHeight = this.$refs.bodyHeader.offsetHeight;
    }
  },
  methods: {
    hasSlot(name) {
      return !!this.$slots[name];
    },
    getBodyMainRef() {
      return this.$refs.bodyMain;
    }
  }
};
</script>

<style lang="scss" scoped>
.apos-modal__body {
  overflow-y: auto;
  padding: $spacing-double;

  @include media-up(lap) {
    padding: $spacing-quadruple;
  }
}

.apos-modal__body--flex {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  overflow-y: initial;
  padding: 0;

  .apos-modal__body-inner {
    overflow-y: auto;
    padding: 20px;
  }
}

.apos-modal__main--no-rails .apos-modal__body {
  padding: 20px;
}

.apos-modal__body-footer {
  display: flex;
  justify-content: space-between;
  padding: 20px;
}

// TODO responsibilty of this setting might change
.apos-modal__body-main .apos-field {
  margin-bottom: 40px;
}
</style>
