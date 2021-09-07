<template>
  <ul class="apos-search">
    <li
      :class="getClasses(item)" v-for="item in list"
      :key="item._id" @click="select(item, $event)"
      v-apos-tooltip="item.disabled ? disabledTooltip : null"
    >
      <div class="apos-search__item__main">
        <div class="apos-search__item__title">
          {{ item.title }}
        </div>
        <div class="apos-search__item__slug">
          {{ item.slug }}
        </div>
      </div>
    </li>
  </ul>
</template>

<script>

export default {
  name: 'AposSearchList',
  props: {
    list: {
      type: Array,
      default() {
        return [];
      }
    },
    selectedItems: {
      type: Array,
      default() {
        return [];
      }
    },
    disabledTooltip: {
      type: String,
      required: false
    }
  },
  emits: [ 'select' ],
  methods: {
    select(item, $event) {
      if (item.disabled) {
        $event.stopPropagation();
        return;
      }
      const selectedItems = this.selectedItems;
      if (!selectedItems.some(selectedItem => selectedItem._id === item._id)) {
        // Never modify a prop
        this.$emit('select', [ ...selectedItems, item ]);
      }
    },
    getClasses(item) {
      const classes = {
        'apos-search__item': true
      };
      if (item.disabled) {
        classes['apos-search__item--disabled'] = true;
      }
      return classes;
    }
  }
};
</script>

<style lang="scss" scoped>
.apos-search {
  z-index: $z-index-default;
  position: absolute;
  top: 37px;
  overflow: auto;
  width: 100%;
  list-style: none;
  box-shadow: var(--a-box-shadow);
  box-sizing: border-box;
  max-height: 300px;
  padding: 0;
  border-bottom-left-radius: var(--a-border-radius);
  border-bottom-right-radius: var(--a-border-radius);
  border: 1px solid var(--a-base-8);
  background: var(--a-background-primary);

  &:empty {
    display: none;
  }
}

@mixin disabled {
  padding: 10px 20px;
  border: none;
  background-color: var(--a-background-primary);
  cursor: auto;
  .apos-search__item__title {
    color: $input-color-disabled;
  }
  .apos-search__item__slug {
    color: $input-color-disabled;
  }
}

.apos-search__item {
  display: flex;
  justify-content: space-between;
  margin: 10px;
  padding: 10px 20px;
  border-radius: var(--a-border-radius);
  box-sizing: border-box;
  transition: background-color 0.3s ease;
  & * {
    pointer-events: none;
  }

  &:hover.apos-search__item {
    padding: 9px 19px;
    border: 1px solid var(--a-base-5);
    background-color: var(--a-base-10);
    cursor: pointer;
    &.apos-search__item--disabled {
      @include disabled;
    }
  }

  &:hover.apos-search__item {
    padding: 9px 19px;
    border: 1px solid var(--a-base-5);
    background-color: var(--a-base-10);
    cursor: pointer;
  }

  &__main {
    display: flex;
    flex-direction: column;
  }

  &__title {
    @include type-base;
    color: var(--a-text-primary);
    margin-bottom: 3px;
  }

  &__slug {
    @include type-base;
    color: var(--a-base-2);
  }

  &.apos-search__item--disabled {
    @include disabled;
  }

}
</style>
