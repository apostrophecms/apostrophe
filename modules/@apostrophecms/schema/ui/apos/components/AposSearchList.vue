<template>
  <ul class="apos-search">
    <li 
      class="apos-search__item item"
      v-for="item in list"
      :key="item._id"
      @click="$emit('select', item);"
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
    }
    // selectedItems: {
    //   type: Array,
    //   default() {
    //     return [];
    //   }
    // }
  },
  emits: [ 'select' ],
  methods: {
    // getTypeLabel(type) {
    //   return apos.modules[type].label;
    // },
    // select(item) {
    //   this.$emit('select', item);
    //   const selectedItems = this.selectedItems;
    //   if (!selectedItems.some(selectedItem => selectedItem._id === item._id)) {
    //     selectedItems.push(item);
    //     this.$emit('select', item);
    //   }
    // }
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
  padding: 15px 25px;
  letter-spacing: 0.5px;
  border-radius: 5px;
  box-sizing: border-box;
  transition: background-color 0.3s ease;
  & * {
    pointer-events: none;
  }

  &:hover {
    padding: 14px 24px;
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
    color: var(--a-text-primary);
    font-size: map-get($font-sizes, input-label);
    margin-bottom: 3px;
  }

  &__slug {
    color: var(--a-base-2);
    font-size: map-get($font-sizes, default);
    font-style: italic;
  }
}
</style>
