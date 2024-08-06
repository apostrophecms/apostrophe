<template>
  <li class="apos-context-menu__item">
    <button
      class="apos-context-menu__button"
      :class="modifiers"
      :tabindex="tabindex"
      role="menuitem"
      data-apos-test="context-menu-item"
      :data-apos-test-selected="selected"
      :data-apos-test-danger="danger"
      :data-apos-test-disabled="disabled"
      @click="click"
    >
      {{ $t(label) }}
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
    selected() {
      return this.menuItem.modifiers?.includes('selected');
    },
    danger() {
      return this.menuItem.modifiers?.includes('danger');
    },
    disabled() {
      return this.menuItem.modifiers?.includes('disabled');
    },
    modifiers() {
      const classes = [];
      if (this.menuItem.modifiers) {
        this.menuItem.modifiers.forEach(modifier => {
          classes.push(`apos-context-menu__button--${modifier}`);
        });
      }
      return classes.join(' ');
    },
    label() {
      let label = this.menuItem.label;
      if (this.selected) {
        label = {
          key: 'apostrophe:selectedMenuItem',
          label: this.$t(this.menuItem.label)
        };
      }
      return label;
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
  .apos-context-menu__item {
    display: flex;
  }

  .apos-context-menu__button {
    @include type-base;

    & {
      display: inline-block;
      flex-grow: 1;
      width: 100%;
      padding: 10px 20px;
      border: none;
      color: var(--a-base-1);
      text-align: left;
      background-color: var(--a-background-primary);
    }

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

    &--primary {
      color: var(--a-primary);

      &:hover,
      &:focus,
      &:active {
        color: var(--a-primary);
      }
    }

    &--disabled {
      color: var(--a-base-5);

      &:hover,
      &:focus,
      &:active {
        cursor: not-allowed;
        color: var(--a-base-5);
      }
    }
  }
</style>
