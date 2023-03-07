<template>
  <div
    class="apos-input-wrapper"
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

  emits: [ 'select-item' ],
  data () {
    return {
      focused: false,
      options: this.renderOptions(),
      boxHeight: 0,
      selectAllLabel: this.getSelectAllLabel()
    };
  },
  computed: {
    selectedItems() {
      if (this.choices.length === this.value.data.length) {
        return [ 'all' ];
      }

      return this.value.data;
    }
  },
  mounted() {
    this.computeBoxHeight();
  },
  methods: {
    renderOptions() {
      if (!this.field.all) {
        return this.choices;
      }

      const { list } = this.getSelectAllLabel();

      return [
        {
          label: list,
          value: 'all'
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
    getSelectedOption(checked) {
      if (checked === 'all') {
        const { selected } = this.getSelectAllLabel();
        return {
          label: selected,
          value: 'all'
        };
      }

      return this.choices.find((choice) => choice.value === checked);
    },
    emitSelectItem(data) {
      return new Promise((resolve) => {
        this.$emit('select-item', data);
        this.$nextTick(resolve);
      });
    },
    async selectOption(choice) {
      const selectedChoice = this.field.all && choice === 'all'
        ? this.getSelectedOption('all')
        : choice;

      await this.emitSelectItem(selectedChoice);

      this.computeBoxHeight();
    },
    computeBoxHeight() {
      this.boxHeight = this.$refs.select.offsetHeight;
    },
    getSelectAllLabel() {
      if (this.field.all.label) {
        const label = this.$t('apostrophe:allItems', { items: this.field.all.label });
        return {
          selected: label,
          list: label
        };
      }

      return {
        selected: this.$t('apostrophe:allSelected'),
        list: this.$t('apostrophe:selectAll')
      };
    }
  }
};
</script>

<style lang="scss" scoped>
.apos-combo {
  font-family: var(--a-family-default);
}

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
  padding: 10px 30px 10px;
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
  font-size: var(--a-type-base);
  font-weight: var(--a-weight-base);
  font-family: var(--a-family-default);
  letter-spacing: var(--a-letter-base);
  line-height: var(--a-line-base);
  background-color: var(--a-white);
  padding: 4px;
  margin: 2px 5px 2px;
  border: 1px solid var(--a-base-8)
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
  max-height: 20vh;
  overflow-y: auto;
  box-shadow: 0 0 3px var(--a-base-2);
  border-radius: var(--a-border-radius);
}

.apos-combo__list-item {
  padding: 10px 10px 10px 20px;
  cursor: pointer;
  font-family: var(--a-family-default);
  color: var(--a-text-primary);
  font-size: var(--a-type-label);
  font-weight: var(--a-weight-base);

  &:hover {
    background-color: var(--a-base-9);
  }
}

</style>
