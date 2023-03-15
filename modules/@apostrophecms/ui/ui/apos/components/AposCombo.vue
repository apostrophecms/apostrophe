<template>
  <div
    class="apos-primary-scrollbar apos-input-wrapper"
    :class="{ 'apos-combo--focused': focused }"
  >
    <ul
      ref="select"
      v-click-outside-element="removeFocus"
      class="apos-input-wrapper apos-combo__select"
      @click="toggleFocus"
    >
      <li
        class="apos-combo__selected"
        v-for="checked in selectedItems"
        :key="checked"
        @click="selectOption(getSelectedOption(checked))"
      >
        {{ getSelectedOption(checked).label }}
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
      class="apos-combo__list"
      :style="{top: boxHeight + 'px'}"
    >
      <li
        :key="choice.value"
        class="apos-combo__list-item"
        v-for="choice in options"
        @click.stop="selectOption(choice)"
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
      focused: false,
      boxHeight: 0,
      showSelectAll,
      options: this.renderOptions(showSelectAll),
      boxResizeObserver: this.getBoxResizeObserver()
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
    toggleFocus() {
      this.focused = !this.focused;
    },
    removeFocus() {
      this.focused = false;
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
    }
  }
};
</script>

<style lang="scss" scoped>
.apos-combo__check-icon {
  position: absolute;
  left: 5px;
}

.apos-combo--focused {

  .apos-combo__select {
    box-shadow: 0 0 3px var(--a-base-2);
    border-color: var(--a-base-2);
    background-color: var(--a-base-10);
  }

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
  display: none;
  position: absolute;
  width: 100%;
  left: 0;
  top: 44px;
  list-style: none;
  background-color: var(--a-white);
  z-index: 1;
  padding-left: 0;
  margin: 0;
  max-height: 300px;
  overflow-y: auto;
  box-shadow: 0 0 3px var(--a-base-2);
  border-radius: var(--a-border-radius);
}

.apos-combo__list-item {
  @include type-base;

  padding: 10px 10px 10px 20px;
  cursor: pointer;

  &:hover {
    background-color: var(--a-base-9);
  }
}

</style>
