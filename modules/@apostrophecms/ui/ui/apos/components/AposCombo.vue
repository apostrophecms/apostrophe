<template>
  <div
    class="apos-input-wrapper"
    :class="{ 'apos-combo--focused': focused }"
  >
    <ul
      v-click-outside-element="removeFocus"
      class="apos-input-wrapper apos-combo__select"
      @click="toggleFocus"
    >
      <li
        class="apos-combo__selected"
        v-for="checked in selectedItems"
        :key="checked"
        @click="$emit('select-item', getSelectedOption(checked))"
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
    <ul class="apos-combo__list">
      <li
        :key="choice.value"
        class="apos-combo__list-item"
        v-for="choice in options"
        @click="selectOption(choice)"
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
      options: this.renderOptions()
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
  methods: {
    renderOptions() {
      if (!this.field.all) {
        return this.choices;
      }

      return [
        {
          label: 'Select All',
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
        return {
          label: 'All Selected',
          value: 'all'
        };
      }

      return this.choices.find((choice) => choice.value === checked);
    },
    selectOption(choice) {
      const selectedChoice = this.field.all && choice === 'all'
        ? this.getSelectedOption('all')
        : choice;

      this.$emit('select-item', selectedChoice);
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

  background-color: var(--a-base-9);
  padding: 15px 30px 15px;
  min-height: 12px;
  border: 1px solid var(--a-base-8);
  border-radius: var(--a-border-radius);
  cursor: pointer;
  list-style: none;

  &:hover {
    border-color: var(--a-base-2);
  }
}

.apos-combo__selected {
  flex-wrap: wrap;
  font-size: var(--a-type-base);
  font-weight: var(--a-weight-base);
  font-family: var(--a-family-default);
  letter-spacing: var(--a-letter-base);
  line-height: var(--a-line-base);
  background-color: var(--a-white);
  padding: 4px;
  margin-right: 5px;
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
