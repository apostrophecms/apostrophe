<template>
  <ul class="apos-search">
    <li class="apos-search__item item" v-for="item in list" :key="item._id">
      <div class="item__main">
        <div class="item__title">{{ item.title }}</div>
        <div class="item__slug">{{ item.slug }}</div>
      </div>
      <div class="item__type apos-theme--primary-purple">{{ item.type }}</div>
    </li>
  </ul>
</template>

<script>
// import AposInputMixin from '../mixins/AposInputMixin.js';

export default {
  name: 'AposSearchList',
  // mixins: [ AposInputMixin ],
  props: {
    list: {
      type: Boolean
    }
  },
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

  .item {
    display: flex;
    padding: 15px;

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
    }
  }
}
</style>
