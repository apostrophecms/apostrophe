<template>
<!-- TODO: hide by default (currently, viisble box-shadow even when empty) -->
<!-- TODO: hide when selection made and click outside the element -->
  <ul class="apos-search">
    <li class="apos-search__item item" v-for="item in list" :key="item._id" @click="select(item)">
      <div class="item__main">
        <div class="item__title">{{ item.title }}</div>
        <div class="item__slug">{{ item.slug }}</div>
      </div>
      <div class="item__type">{{ getTypeLabel(item.type) }}</div>
    </li>
  </ul>
</template>

<script>

export default {
  name: 'AposSearchList',
  props: {
    list: {
      type: Array
    }
  },
  emits: ['select'],
  data () {
    return {
      selectedItems: []
    }
  },
  methods: {
    getTypeLabel(type) {
      return apos.modules[type].label
    },
    select(item) {
      if (!this.selectedItems.some(selectedItem => selectedItem._id === item._id)) {
        this.selectedItems.push(item);
        this.$emit('select', this.selectedItems);
      }
    }
  }
}
</script>

<style lang="scss" scoped>
.apos-search {
  z-index: $z-index-default;
  position: absolute;
  top: 34px;
  overflow: scroll;
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
}

.item {
  display: flex;
  justify-content: space-between;
  padding: 15px 25px;
  letter-spacing: 0.5px;

  & * {
    pointer-events: none;
  }

  &:hover {
    margin: 0 20px;
    padding: 12px 6px;
    border: 1px solid var(--a-base-5);
    background: var(--a-base-10);
    box-sizing: border-box;
    border-radius: 5px;

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
  }

  &__slug {
    color: var(--a-base-2);
    font-size: map-get($font-sizes, default);
  }

  &__type {
    padding: 10px 20px;
    border-radius: var(--a-border-radius);
    color: var(--a-background-primary);
    background: var(--a-primary);
  }
}
</style>
