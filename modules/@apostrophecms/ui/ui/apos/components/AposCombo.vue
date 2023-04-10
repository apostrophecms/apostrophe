<template>
  <div
    class="apos-primary-scrollbar apos-input-wrapper"
    aria-haspopup="menu"
    :class="{'apos-input-wrapper--disabled': field.readOnly}"
  >
    <ul
      ref="select"
      role="button"
      :aria-expanded="showedList.toString()"
      :aria-controls="`${field._id}-combo`"
      v-click-outside-element="closeList"
      class="apos-input-wrapper apos-combo__select"
      @click="toggleList"
      :tabindex="field.readOnly ? null : 0"
      @keydown.prevent.space="toggleList"
      @keydown.prevent.up="toggleList"
      @keydown.prevent.down="toggleList"
    >
      <li
        class="apos-combo__selected"
        v-for="checked in selectedItems"
        :key="checked"
        @click="selectOption(getSelectedOption(checked))"
      >
        {{ getSelectedOption(checked)?.label }}
        <AposIndicator
          icon="close-icon"
          class="apos-combo__close-icon"
          :icon-size="10"
        />
      </li>
    </ul>
    <AposIndicator
      icon="menu-down-icon"
      class="apos-input-icon"
      :icon-size="20"
    />
    <ul
      :id="`${field._id}-combo`"
      ref="list"
      role="menu"
      class="apos-combo__list"
      :class="{'apos-combo__list--showed': showedList}"
      :style="{top: boxHeight + 'px'}"
      tabindex="0"
      @keydown.prevent.space="selectOption(options[focusedItemIndex])"
      @keydown.prevent.enter="selectOption(options[focusedItemIndex])"
      @keydown.prevent.arrow-down="focusListItem()"
      @keydown.prevent.arrow-up="focusListItem(true)"
      @keydown.prevent.delete="closeList(null, true)"
      @keydown.prevent.stop.esc="closeList(null, true)"
      @blur="closeList()"
    >
      <li
        :key="choice.value"
        class="apos-combo__list-item"
        role="menuitemcheckbox"
        :class="{focused: focusedItemIndex === i}"
        v-for="(choice, i) in options"
        @click.stop="selectOption(choice)"
        @mouseover="focusedItemIndex = i"
      >
        <AposIndicator
          v-if="isSelected(choice)"
          icon="check-bold-icon"
          class="apos-combo__check-icon"
          :icon-size="10"
        />
        {{ choice.label }}
      </li>
    </ul>
  </div>
</template>

<script>
export default {
  name: 'AposCombo',
  props: {
    choices: {
      type: Array,
      required: true
    },
    field: {
      type: Object,
      required: true
    },
    value: {
      type: Object,
      required: true
    }
  },

  emits: [ 'select-items' ],
  data () {
    const showSelectAll = this.field.all !== false &&
      (!this.field.max || this.field.max > this.choices.length);

    return {
      showedList: false,
      boxHeight: 0,
      showSelectAll,
      options: this.renderOptions(showSelectAll),
      boxResizeObserver: this.getBoxResizeObserver(),
      focusedItemIndex: null
    };
  },
  computed: {
    selectedItems() {
      if (this.allItemsSelected()) {
        return [ '__all' ];
      }

      return this.value.data;
    }
  },
  mounted() {
    this.boxResizeObserver.observe(this.$refs.select);
  },
  beforeDestroy() {
    this.boxResizeObserver.unobserve(this.$refs.select);
  },
  methods: {
    toggleList() {
      if (this.field.readOnly) {
        return;
      }
      this.showedList = !this.showedList;

      if (this.showedList) {
        this.$nextTick(() => {
          this.$refs.list.focus();
          this.focusedItemIndex = 0;
        });
      } else {
        this.$refs.select.focus();
        this.resetList();
      }
    },
    closeList(_, focusSelect) {
      this.showedList = false;
      this.resetList();

      if (focusSelect) {
        this.$nextTick(() => {
          this.$refs.select.focus();
        });
      }
    },
    resetList() {
      this.focusedItemIndex = null;
      this.$refs.list.scrollTo({ top: 0 });
    },
    getBoxResizeObserver() {
      return new ResizeObserver(([ { target } ]) => {
        if (target.offsetHeight !== this.boxHeight) {
          this.boxHeight = target.offsetHeight;
        }
      });
    },
    renderOptions(showSelectAll) {
      if (!showSelectAll) {
        return this.choices;
      }

      const { listLabel } = this.getSelectAllLabel();

      return [
        {
          label: listLabel,
          value: '__all'
        },
        ...this.choices
      ];
    },
    isSelected(choice) {
      return this.value.data.some((val) => val === choice.value);
    },
    allItemsSelected () {
      return this.value.data.length === this.choices.length;
    },
    getSelectedOption(checked) {
      if (checked === '__all') {
        const { selectedLabel } = this.getSelectAllLabel();
        return {
          label: selectedLabel,
          value: checked
        };
      }

      return this.choices.find((choice) => choice.value === checked);
    },
    emitSelectItems(data) {
      return new Promise((resolve) => {
        this.$emit('select-items', data);
        this.$nextTick(resolve);
      });
    },
    async selectOption(choice) {
      if (this.field.readOnly) {
        return;
      }

      const selectedChoice = this.showSelectAll && choice === '__all'
        ? this.getSelectedOption('__all')
        : choice;

      await this.emitSelectItems(selectedChoice);

      if (this.showSelectAll) {
        const { listLabel } = this.getSelectAllLabel();
        this.options[0].label = listLabel;
      }
    },

    getSelectAllLabel() {
      const allSelected = this.allItemsSelected();
      const defaultSelectAllListLabel = allSelected
        ? this.$t('apostrophe:deselectAll')
        : this.$t('apostrophe:selectAll');
      const selectedLabel = this.$t('apostrophe:allSelected');

      if (this.field?.all?.label) {
        const selectAllLabel = this.$t(this.field.all.label);
        return {
          selectedLabel,
          listLabel: allSelected ? defaultSelectAllListLabel : selectAllLabel
        };
      }

      return {
        selectedLabel,
        listLabel: defaultSelectAllListLabel
      };
    },
    focusListItem(prev = false) {
      const destIndex = (i) => prev ? i - 1 : i + 1;
      const fallback = prev ? this.options.length - 1 : 0;
      if (this.focusedItemIndex == null) {
        this.focusedItemIndex = fallback;
      } else {
        this.focusedItemIndex = this.options[destIndex(this.focusedItemIndex)]
          ? destIndex(this.focusedItemIndex)
          : fallback;
      }

      const itemHeight = this.$refs.list.querySelector('li')?.clientHeight || 32;
      const focusedItemPos = itemHeight * this.focusedItemIndex;
      const { clientHeight, scrollTop } = this.$refs.list;
      const listVisibility = clientHeight + scrollTop;
      const scrollTo = (top) => {
        this.$refs.list.scrollTo({
          top,
          behavior: 'smooth'
        });
      };
      if (focusedItemPos + itemHeight > listVisibility) {
        scrollTo((focusedItemPos + itemHeight) - clientHeight);
      } else if (focusedItemPos < (listVisibility - clientHeight)) {
        scrollTo(focusedItemPos);
      }
    }
  }
};
</script>

<style lang="scss" scoped>
.apos-combo__check-icon {
  position: absolute;
  left: 5px;
}

.apos-input-wrapper:focus {
  .apos-combo__list {
    display: block;
  }
}

.apos-combo__select {
  display: flex;
  flex-wrap: wrap;
  background-color: var(--a-base-9);
  padding: 10px 30px 10px 8px;
  min-height: 26px;
  border: 1px solid var(--a-base-8);
  border-radius: var(--a-border-radius);
  cursor: pointer;
  list-style: none;

  &:hover {
    border-color: var(--a-base-2);
  }

  &:focus {
    box-shadow: 0 0 3px var(--a-base-2);
    border-color: var(--a-base-2);
    background-color: var(--a-base-10);
    outline: none;
  }
}

.apos-input-wrapper--disabled {
  .apos-combo__select {
    color: var(--a-base-4);
    background: var(--a-base-7);
    border-color: var(--a-base-4);
    cursor: not-allowed;

    &:hover {
      border-color: var(--a-base-4);
    }
  }

  .apos-combo__selected {
    background-color: var(--a-base-8);
    border-color: var(--a-base-3);
    opacity: 0.7;
  }

  .apos-input-icon {
    opacity: 0.7;
  }
}

.apos-combo__selected {
  @include type-base;
  display: flex;
  align-items: center;
  gap: 4px;
  background-color: var(--a-white);
  margin: 2px;
  padding: 5px 8px;
  border: 1px solid var(--a-base-8);
  border-radius: var(--a-border-radius);

  &:hover {
    background-color: var(--a-base-8);
    border-color: var(--a-base-3);
    cursor: not-allowed;
  }

  ::v-deep .apos-indicator {
    width: 10px;
    height: 10px;
  }
}

.apos-combo__list {
  z-index: $z-index-default;
  position: absolute;
  top: 44px;
  left: 0;
  display: none;
  width: 100%;
  list-style: none;
  background-color: var(--a-white);
  padding-left: 0;
  margin: 0;
  max-height: 300px;
  overflow-y: auto;
  box-shadow: 0 0 3px var(--a-base-2);
  border-radius: var(--a-border-radius);
  outline: none;

  &--showed {
    display: block;
  }
}

.apos-combo__list-item {
  @include type-base;

  padding: 10px 10px 10px 20px;
  cursor: pointer;

  &.focused {
    background-color: var(--a-base-9);
  }
}

</style>
