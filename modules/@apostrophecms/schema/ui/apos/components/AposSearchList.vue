<template>
  <ul class="apos-search">
    <li
      class="apos-search__item item" v-for="item in list"
      :key="item._id" @click="select(item)"
    >
      <div class="item__main">
        <div class="item__title">
          {{ item.title }}
        </div>
        <div class="item__slug">
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
    }
  },
  emits: [ 'select' ],
  methods: {
    select(item) {
      const selectedItems = this.selectedItems;
      if (!selectedItems.some(selectedItem => selectedItem._id === item._id)) {
        // Never modify a prop
        this.$emit('select', [ ...selectedItems, item ]);
      }
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

.item {
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

  &:hover {
    padding: 9px 19px;
    border: 1px solid var(--a-base-5);
    background-color: var(--a-base-10);
    cursor: pointer;

    .item__type {
      display: none;
    }
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
}
</style>
