<template>
  <transition
    name="collapse"
    :duration="300"
  >
    <div
      v-show="showSelectAll"
      class="apos-select-box"
    >
      <div class="apos-select-box__content">
        <p class="apos-select-box__text">
          {{ selectBoxMessage }}
          <AposButton
            v-if="!allPiecesSelection.isSelected"
            type="subtle"
            :modifiers="['inline', 'small', 'no-motion']"
            :label="selectBoxMessageButton"
            class="apos-select-box__select-all"
            text-color="var(--a-primary)"
            :disabled="!showSelectAll"
            @click="$emit('select-all')"
          />
          <AposButton
            v-else
            type="subtle"
            :modifiers="['inline', 'small', 'no-motion']"
            label="apostrophe:clearSelection"
            class="apos-select-box__select-all"
            text-color="var(--a-primary)"
            :disabled="!showSelectAll"
            @click="clearSelection"
          />
        </p>
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
    },
    displayedItems: {
      type: Number,
      required: true
    }
  },
  emits: [ 'select-all', 'clear-select', 'set-all-pieces-selection' ],
  computed: {
    showSelectAll() {
      if (
        this.allPiecesSelection.isSelected ||
        ([ 'checked', 'indeterminate' ].includes(this.selectedState) && this.allPiecesSelection.total > this.displayedItems)
      ) {
        return true;
      }
      return false;
    },
    selectBoxMessage () {
      const checkedCount = this.checkedIds.length;
      const showAllWord = (checkedCount === this.allPiecesSelection.total) &&
        checkedCount !== 1;

      const translationKey = this.allPiecesSelection.isSelected
        ? showAllWord
          ? 'apostrophe:selectBoxMessageAllSelected'
          : 'apostrophe:selectBoxMessageSelected'
        : checkedCount > this.displayedItems
          ? 'apostrophe:selectBoxMessage'
          : 'apostrophe:selectBoxMessagePage';

      return this.$t(translationKey, {
        num: this.checkedIds.length,
        label: this.getLabel(this.checkedIds.length)
      });
    },
    selectBoxMessageButton () {
      const translationKey = this.allPiecesSelection.total === 1
        ? 'apostrophe:selectBoxMessageButton'
        : 'apostrophe:selectBoxMessageAllButton';

      return this.$t(translationKey, {
        num: this.allPiecesSelection.total,
        label: this.getLabel(this.allPiecesSelection.total)
      });
    }
  },
  methods: {
    getLabel(number) {
      return number === 1
        ? this.$t(this.moduleLabels.singular).toLowerCase()
        : this.$t(this.moduleLabels.plural).toLowerCase();
    },
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
    overflow: hidden;
    box-sizing: border-box;
    transition: max-height 200ms ease-in;
    max-height: 65px;

    &.collapse-enter, &.collapse-leave-to {
      max-height: 0;
    }

    &__content {
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: var(--a-base-10);
      margin-top: 1rem;
      color: var(--a-text-primary);
      border-radius: var(--a-border-radius);
    }

    &__text {
      @include type-base;
    }

    &__select-all {
      margin-left: $spacing-half;
    }
  }
</style>
