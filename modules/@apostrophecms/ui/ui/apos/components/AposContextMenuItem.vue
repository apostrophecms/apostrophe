<template>
  <li class="apos-context-menu__item">
    <button
      class="apos-context-menu__button"
      @click="click"
      :tabindex="tabindex"
    >
      {{ menuItem.label }}
    </button>
  </li>
</template>

<script>
export default {
  name: 'AposContextMenuItem',
  props: {
    menuItem: {
      type: Object,
      required: true
    },
    open: Boolean,
    itemProps: {
      type: Object,
      default() {
        return {};
      }
    }
  },
  emits: [ 'clicked' ],
  computed: {
    tabindex() {
      return this.open ? '0' : '-1';
    }
  },
  methods: {
    click() {
      this.$emit('clicked', this.menuItem.action);
      apos.bus.$emit('context-menu-item-clicked', this.itemProps);
    }
  }
};
</script>

<style lang="scss" scoped>
  .apos-context-menu__button {
    display: inline-block;
    width: 100%;
    padding: 10px 20px;
    border: none;
    color: var(--a-base-1);
    font-size: map-get($font-sizes, default);
    text-align: left;
    letter-spacing: 0.5px;
    background-color: var(--a-background-primary);
    &:hover {
      cursor: pointer;
      color: var(--a-text-primary);
    }
    &:focus {
      outline: none;
      color: var(--a-text-primary);
    }
    &:active {
      color: var(--a-base-1);
    }
  }
</style>
