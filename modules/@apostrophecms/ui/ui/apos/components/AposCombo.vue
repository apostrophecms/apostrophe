<template>
  <div
    class="apos-primary-scrollbar apos-input-wrapper"
    aria-haspopup="menu"
    :class="{'apos-input-wrapper--disabled': field.readOnly}"
  >
    <ul
      ref="select"
      v-click-outside-element="closeList"
      role="button"
      :aria-expanded="showedList.toString()"
      :aria-controls="`${field._id}-combo`"
      class="apos-input-wrapper apos-combo__select"
      :tabindex="field.readOnly ? null : 0"
      @click="toggleList"
      @keydown.prevent.space="toggleList"
      @keydown.prevent.up="toggleList"
      @keydown.prevent.down="toggleList"
    >
      <li
        v-for="checked in selectedItems"
        :key="objectValues ? checked.value : checked"
        class="apos-combo__selected"
        @click.stop="selectOption(getSelectedOption(checked))"
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
      @keydown="onListKey"
      @blur="closeList()"
    >
      <li
        v-if="typehead"
        key="__typehead"
        class="apos-combo__list-typehead"
        @click.stop="$refs.input.focus()"
      >
        <input
          ref="input"
          class="apos-combo__typehead"
          type="text"
          :placeholder="$t('apostrophe:search')"
          :value="thInput"
          @input="onTypeheadInput"
          @keydown="onTypeheadKey"
        >
        <AposSpinner
          v-if="busy"
          class="apos-combo__spinner"
          color="--a-base-5"
        />
      </li>
      <li
        v-for="(choice, i) in options"
        :key="choice.value"
        class="apos-combo__list-item"
        role="menuitemcheckbox"
        :class="{focused: focusedItemIndex === i}"
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
    modelValue: {
      type: Object,
      required: true
    },
    typehead: {
      type: Boolean,
      default: false
    },
    busy: {
      type: Boolean,
      default: false
    },
    // When true, indicates that the values and selected items are arrays of objects,
    // array of primitive values otherwise.
    objectValues: {
      type: Boolean,
      default: false
    }
  },

  emits: [ 'select-items', 'toggle', 'update:modelValue' ],
  data () {

    return {
      showedList: false,
      boxHeight: 0,
      boxResizeObserver: this.getBoxResizeObserver(),
      focusedItemIndex: null,
      thInput: ''
    };
  },
  computed: {
    showSelectAll() {
      return this.field.all !== false &&
        (!this.field.max || this.field.max > this.choices.length);
    },
    options() {
      return this.renderOptions(this.showSelectAll);
    },
    selectedItems() {
      if (!this.showSelectAll || !this.allItemsSelected()) {
        return this.modelValue.data;
      }
      if (this.objectValues) {
        const { listLabel } = this.getSelectAllLabel();
        return [ {
          label: listLabel,
          value: '__all'
        } ];
      }
      return [ '__all' ];
    }
  },
  mounted() {
    this.boxResizeObserver.observe(this.$refs.select);
  },
  beforeUnmount() {
    this.boxResizeObserver.unobserve(this.$refs.select);
  },
  methods: {
    onTypeheadInput(e) {
      this.thInput = e.target.value;
      this.$emit('update:modelValue', this.thInput);
    },
    onTypeheadKey(e) {
      const stop = () => {
        e.preventDefault();
        e.stopPropagation();
      };
      switch (e.key) {
        case 'ArrowDown':
          stop();
          this.focusListItem();
          break;

        case 'ArrowUp':
          stop();
          this.focusListItem(true);
          break;

        case 'Enter':
          stop();
          this.selectOption(this.options[this.focusedItemIndex]);
          break;

        case 'Tab':
          stop();
          this.closeList(null, true);
          break;
      }
    },
    toggleList() {
      if (this.field.readOnly) {
        return;
      }
      this.showedList = !this.showedList;

      if (this.showedList) {
        this.$emit('toggle', true);
        this.$nextTick(() => {
          this.focusedItemIndex = 0;
          if (this.typehead) {
            this.$refs.input.focus();
          } else {
            this.$refs.list.focus();
          }
        });
      } else {
        this.$refs.select.focus();
        this.resetList();
      }
    },
    onListKey(e) {
      const stop = () => {
        e.preventDefault();
        e.stopPropagation();
      };
      switch (e.key) {
        case ' ': // Brave issues
        case 'Space': {
          if (!this.typehead) {
            stop();
            this.selectOption(this.options[this.focusedItemIndex]);
          }
          break;
        }

        case 'Enter': {
          stop();
          this.selectOption(this.options[this.focusedItemIndex]);
          break;
        }

        case 'ArrowDown': {
          stop();
          this.focusListItem();
          break;
        }

        case 'ArrowUp': {
          stop();
          this.focusListItem(true);
          break;
        }

        case 'Delete': {
          if (!this.typehead) {
            stop();
            this.closeList(null, true);
          }
          break;
        }

        case 'Escape': {
          stop();
          this.closeList(null, true);
          break;
        }
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
      this.$emit('toggle', false);
      this.focusedItemIndex = null;
      this.$refs.list.scrollTo({ top: 0 });
      this.thInput = '';
      this.$emit('update:modelValue', this.thInput);
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
      const condition = (entry) => (
        this.objectValues
          ? entry.value === choice.value
          : entry === choice.value
      );

      return this.modelValue.data.some(condition);
    },
    allItemsSelected () {
      return this.choices.length && this.modelValue.data.length === this.choices.length;
    },
    getSelectedOption(checked) {
      if (this.objectValues) {
        return checked;
      }
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

  & {
    display: flex;
    align-items: center;
    gap: 4px;
    background-color: var(--a-white);
    margin: 2px;
    padding: 5px 8px;
    border: 1px solid var(--a-base-8);
    border-radius: var(--a-border-radius);
  }

  &:hover {
    background-color: var(--a-base-8);
    border-color: var(--a-base-3);
    cursor: not-allowed;
  }

  :deep(.apos-indicator) {
    width: 10px;
    height: 10px;
  }
}

.apos-combo__list {
  z-index: $z-index-manager-display;
  position: absolute;
  top: 44px;
  left: 0;
  display: none;
  width: 100%;
  margin: 0;
  padding-left: 0;
  list-style: none;
  background-color: var(--a-white);
  max-height: 300px;
  overflow-y: auto;
  box-shadow: 0 0 3px var(--a-base-2);
  border-radius: var(--a-border-radius);
  outline: none;

  &--showed {
    display: block;
  }

  &-typehead {
    display: flex;
    box-sizing: border-box;
    align-items: center;
  }
}

.apos-combo__list-item {
  @include type-base;

  & {
    padding: 10px 10px 10px 20px;
    cursor: pointer;
  }

  &.focused {
    background-color: var(--a-base-9);
  }
}

.apos-combo__typehead {
  @include type-base;

  & {
    box-sizing: border-box;
    flex-grow: 1;
    margin: 0;
    padding: 10px 10px 10px 20px;
    border: none;
    outline: none;
    background-color: transparent;
  }
}

.apos-combo__spinner {
  margin-right: 15px;
  opacity: 0.7;
}

</style>
