<template>
  <AposButton
    v-if="options.expanded"
    :disabled="disabled"
    v-bind="buttonOptions"
    @click="openExpandedMenu(index)"
    role="button"
  />
  <AposAreaContextualMenu
    v-else
    @add="$emit('add', $event);"
    :button-options="buttonOptions"
    :context-menu-options="contextMenuOptions"
    :empty="true"
    :index="index"
    :widget-options="options.widgets"
    :options="options"
    :max-reached="maxReached"
    :disabled="disabled"
  />
</template>

<script>
export default {
  name: 'AposAreaMenu',
  props: {
    disabled: {
      type: Boolean,
      default: false
    },
    empty: {
      type: Boolean,
      default: false
    },
    contextMenuOptions: {
      type: Object,
      required: true
    },
    index: {
      type: Number,
      default: 0
    },
    options: {
      type: Object,
      required: true
    },
    maxReached: {
      type: Boolean
    },
    // NOTE: Left for backwards compatibility.
    // Should use options now instead.
    widgetOptions: {
      type: Object,
      default: function() {
        return {};
      }
    }
  },
  emits: [ 'add' ],
  computed: {
    buttonOptions() {
      return {
        label: 'apostrophe:addContent',
        icon: 'plus-icon',
        type: 'primary',
        modifiers: this.empty ? [] : [ 'round', 'tiny' ],
        iconSize: this.empty ? 20 : 11
      };
    }
  },
  methods: {
    async openExpandedMenu(index) {
      const data = await apos.modal.execute('AposAreaExpandedMenu', {
        field: this.field,
        options: this.options,
        index
      });

      if (data) {
        this.$emit('add', data);
      }
    }
  }
};
</script>

<style lang="scss" scoped>

.apos-area-menu.apos-is-focused ::v-deep .apos-context-menu__inner {
  border: 1px solid var(--a-base-4);
}

.apos-area-menu.apos-is-focused ::v-deep .apos-context-menu__tip-outline {
  stroke: var(--a-base-4);
}

.apos-area-menu__wrapper,
.apos-area-menu__items,
.apos-area-menu__group-list {
  @include apos-list-reset();
}

.apos-area-menu__wrapper {
  min-width: 250px;
}

.apos-area-menu__button {
  @include apos-button-reset();
  @include type-base;
  box-sizing: border-box;
  width: 100%;
  padding: 5px 20px;
  color: var(--a-base-1);

  &:hover,
  &:focus {
    & ::v-deep .apos-area-menu__item-icon {
      color: var(--a-primary);
    }
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
}

.apos-area-menu__accordion-trigger {
  z-index: $z-index-under;
  opacity: 0;
  position: absolute;
}

.apos-area-menu__group-label {
  @include apos-button-reset();
  box-sizing: border-box;
  display: flex;
  width: 100%;
  justify-content: space-between;
  padding: 10px 20px;
  &:hover {
    cursor: pointer;
  }

  &:focus {
    background-color: var(--a-base-10);
    outline: 1px solid var(--a-base-4);
  }
}

.apos-area-menu__group-chevron {
  @include apos-transition();
  transform: rotate(90deg);
}

.apos-area-menu__group-chevron.apos-is-active {
  transform: rotate(180deg);
}

.apos-area-menu__group {
  border-bottom: 1px solid var(--a-base-8);
  padding-bottom: 10px;
  margin: 10px 0;
}
.apos-area-menu__item:last-child.apos-has-group .apos-area-menu__group {
  border-bottom: none;
  margin-bottom: 0;
}

.apos-area-menu__items--accordion {
  overflow: hidden;
  max-height: 0;
  @include apos-transition($duration:0.3s);
}

.apos-area-menu__items--accordion.apos-is-active {
  transition-delay: 0.25s;
  max-height: 20rem;
}

</style>
