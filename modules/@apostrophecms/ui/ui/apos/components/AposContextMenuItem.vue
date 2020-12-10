<template>
  <li class="apos-context-menu__item">
    <button
      class="apos-context-menu__button"
      :class="modifiers"
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
    open: Boolean
  },
  emits: [ 'clicked' ],
  computed: {
    tabindex() {
      return this.open ? '0' : '-1';
    },
    modifiers() {
      const classes = [];
      if (this.menuItem.modifiers) {
        this.menuItem.modifiers.forEach(modifier => {
          classes.push(`apos-context-menu__button--${modifier}`);
        });
      }
      return classes.join(' ');
    }
  },
  methods: {
    click() {
      this.$emit('clicked', this.menuItem.action);
    }
  }
};
</script>

<style lang="scss" scoped>
  .apos-context-menu__button {
    @include type-base;
    display: inline-block;
    width: 100%;
    padding: 10px 20px;
    border: none;
    color: var(--a-base-1);
    text-align: left;
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

    &--danger {
      color: var(--a-danger);
      &:hover {
        color: var(--a-danger-button-hover);
      }
      &:focus, &:active {
        color: var(--a-danger-button-active);
      }
    }
  }
</style>
