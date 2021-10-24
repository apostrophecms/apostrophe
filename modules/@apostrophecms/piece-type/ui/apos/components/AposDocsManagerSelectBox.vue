<template>
  <transition
    name="collapse"
    :duration="300"
  >
    <div
      v-if="selectedState === 'checked' || allPiecesSelection.isSelected"
      class="apos-select-box"
    >
      <div class="apos-select-box__content">
        <h3 v-if="!allPiecesSelection.isSelected" class="apos-select-box__text">
          {{ getPiecesNumber }} on this page selected.
          <span @click="$emit('select-all')" class="apos-select-box__select-all">
            Select all {{ getTotalPiecesNumber }}.
          </span>
        </h3>
        <h3 v-else class="apos-select-box__text">
          All {{ getPiecesNumber }} selected.
          <span @click="clearSelection" class="apos-select-box__select-all">
            Clear Selection.
          </span>
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
    checkedIds: {
      type: Array,
      required: true
    },
    allPiecesSelection: {
      type: Object,
      required: true
    }
  },
  emits: [ 'select-all', 'clear-select', 'set-all-pieces-selection' ],
  computed: {
    getPiecesNumber () {
      return `${this.checkedIds.length} ${this.checkedIds.length === 1
        ? this.moduleLabels.singular
        : this.moduleLabels.plural}`.toLowerCase();
    },
    getTotalPiecesNumber () {
      return `${this.allPiecesSelection.total} ${this.allPiecesSelection.total === 1
        ? this.moduleLabels.singular
        : this.moduleLabels.plural}`.toLowerCase();
    }
  },
  methods: {
    clearSelection () {
      this.$emit('set-all-pieces-selection', {
        isSelected: false,
        docs: []
      });
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
    }

    &__select-all {
      color: var(--a-primary);
      cursor: pointer;
      margin-left: 0.4rem;

      &:hover {
        text-decoration: underline;
      }
    }
  }
</style>
