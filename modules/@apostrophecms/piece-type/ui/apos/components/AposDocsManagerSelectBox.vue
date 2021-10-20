<template>
  <transition
    name="collapse"
    :duration="300"
  >
    <div
      v-if="selectedState === 'checked'"
      class="apos-select-box"
    >
      <div class="apos-select-box__content">
        <h3 class="apos-select-box__text">
          {{ getItemsNumber }} on this page selected.
        </h3>
      </div>
    </div>
  </transition>
</template>

<script>

export default {
  props: {
    selectedState: {
      type: String,
      required: true
    },
    moduleLabels: {
      type: Object,
      required: true
    },
    filterValues: {
      type: Object,
      required: true
    },
    checkedIds: {
      type: Array,
      required: true
    }
  },
  computed: {
    getItemsNumber () {
      return `${this.checkedIds.length} ${this.checkedIds.length === 1
        ? this.moduleLabels.singular
        : this.moduleLabels.plural}`;
    }
  }
};
</script>
<style lang='scss' scoped>
  .apos-select-box {
    box-sizing: border-box;
    overflow: hidden;
    height: 5rem;
    transition: all 0.3s linear;

    &.collapse-enter, &.collapse-leave-to {
      height: 0;
    }

    &__content {
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: var(--a-base-9);
      margin-top: 1rem;
      color: var(--a-text-primary);
    }

    &__text {
      @include type-large;
      text-transform: lowercase;
    }
  }

</style>
