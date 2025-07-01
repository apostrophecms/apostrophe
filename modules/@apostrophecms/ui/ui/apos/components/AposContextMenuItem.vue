<template>
  <li
    class="apos-context-menu__item"
    :class="menuItem.separator ? 'apos-context-menu__item--separator' : null"
  >
    <hr
      v-if="menuItem.separator"
      class="apos-context-menu__separator"
    >
    <button
      v-else
      class="apos-context-menu__button"
      :class="modifiers"
      :tabindex="tabindex"
      role="menuitem"
      data-apos-test="context-menu-item"
      :data-apos-test-selected="selected"
      :data-apos-test-danger="danger"
      :data-apos-test-disabled="disabled"
      v-on="disabled ? {} : { click: click }"
    >
      <AposIndicator
        v-if="menuItem.icon"
        class="apos-context-menu__icon"
        :icon="menuItem.icon"
        :icon-size="menuItem.iconSize"
        :icon-color="menuItem.iconFill"
      />
      <span class="apos-context-menu__label">
        {{ $t(label) }}
      </span>
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
    isActive: {
      type: Boolean,
      default: false
    }
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
      return !!this.menuItem.modifiers?.includes('disabled');
    },
    modifiers() {
      const classes = [];
      if (this.menuItem.modifiers) {
        this.menuItem.modifiers.forEach((modifier) => {
          classes.push(`apos-context-menu__button--${modifier}`);
        });
      }
      if (this.isActive) {
        classes.push('apos-context-menu__active');
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
      this.$emit('clicked', this.menuItem);
    }
  }
};
</script>

<style lang="scss" scoped>
.apos-context-menu__item {
  display: flex;
  align-items: center;
}

.apos-context-menu__item:not(.apos-context-menu__item--separator) {
  min-height: 36px;
}

.apos-context-menu__separator {
  box-sizing: border-box;
  width: 100%;
  margin: $spacing-half 0;
  padding: 0;
  border-color: var(--a-base-10);
  border-style: solid;
}

.apos-context-menu__button {
  @include type-base;

  & {
    display: inline-flex;
    flex-grow: 1;
    align-items: center;
    width: 100%;
    margin: 0 $spacing-three-quarters;
    padding: $spacing-base;
    border: none;
    font-size: var(--a-type-menu);
    font-weight: 300;
    text-align: left;
    border-radius: $spacing-half;
    background-color: var(--a-background-primary);
  }

  &:hover {
    cursor: pointer;
    background-color: var(--a-primary-transparent-05);
  }

  &:focus,
  &:active {
    outline: 1px solid var(--a-primary-transparent-25);
    background-color: var(--a-primary-transparent-05);
  }

  &--danger {
    color: var(--a-danger);

    &:hover {
      color: var(--a-danger-button-hover);
    }

    &:hover,
    &:focus,
    &:active {
      background-color: var(--a-danger-button-background);
    }

    &:focus,
    &:active {
      outline: 1px solid var(--a-danger);
      color: var(--a-danger-button-active);
    }
  }

  &--primary {
    color: var(--a-primary);

    &:hover,
    &:focus,
    &:active {
      color: var(--a-primary);
      background-color: var(--a-primary-transparent-15);
    }

    &:focus,
    &:active {
      outline: 1px solid var(--a-primary-transparent-25);
    }
  }

  &--disabled {
    color: var(--a-base-3);

    &:focus,
    &:active {
      outline: 1px solid var(--a-base-8);
    }

    &:hover,
    &:focus,
    &:active {
      cursor: not-allowed;
      color: var(--a-base-5);
      background-color: var(--a-base-9);
    }
  }

  .apos-context-menu__icon {
    margin-right: 7px;
  }
}

.apos-context-menu__active {
  background-color: var(--a-base-10);
}
</style>
