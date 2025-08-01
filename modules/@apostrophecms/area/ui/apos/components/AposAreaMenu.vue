<template>
  <AposButton
    v-if="options.expanded"
    v-bind="buttonOptions"
    :disabled="isDisabled"
    role="button"
    @click="openExpandedMenu(index)"
  />
  <AposAreaContextualMenu
    v-else
    :button-options="buttonOptions"
    :context-menu-options="contextMenuOptions"
    :empty="true"
    :index="index"
    :widget-options="options.widgets"
    :options="options"
    :field-id="fieldId"
    :max-reached="maxReached"
    :disabled="isDisabled"
    :menu-id="menuId"
    :open="open"
    @add="$emit('add', $event);"
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
    },
    fieldId: {
      type: String,
      required: true
    },
    tabbable: {
      type: Boolean,
      default: false
    },
    menuId: {
      type: String,
      default: null
    },
    open: {
      type: Boolean
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
        iconSize: this.empty ? 20 : 11,
        disableFocus: !this.tabbable
      };
    },
    isDisabled() {
      let flag = this.disabled;
      if (this.maxReached) {
        flag = true;
      }
      return flag;
    }
  },
  methods: {
    async openExpandedMenu(index) {
      const data = await apos.modal.execute('AposAreaExpandedMenu', {
        fieldId: this.fieldId,
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

.apos-area-menu.apos-is-focused :deep(.apos-context-menu__inner) {
  border: 1px solid var(--a-base-4);
}

.apos-area-menu.apos-is-focused :deep(.apos-context-menu__tip-outline) {
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

  & {
    box-sizing: border-box;
    width: 100%;
    padding: 5px 20px;
    color: var(--a-base-1);
  }

  &:hover,
  &:focus {
    &:deep(.apos-area-menu__item-icon) {
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

  & {
    display: flex;
    box-sizing: border-box;
    justify-content: space-between;
    width: 100%;
    padding: 10px 20px;
  }

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

  & {
    transform: rotate(90deg);
  }
}

.apos-area-menu__group-chevron.apos-is-active {
  transform: rotate(180deg);
}

.apos-area-menu__group {
  margin: 10px 0;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--a-base-8);
}

.apos-area-menu__item:last-child.apos-has-group .apos-area-menu__group {
  margin-bottom: 0;
  border-bottom: none;
}

.apos-area-menu__items--accordion {
  @include apos-transition($duration:0.3s);

  & {
    overflow: hidden;
    max-height: 0;
  }
}

.apos-area-menu__items--accordion.apos-is-active {
  transition-delay: 250ms;
  max-height: 20rem;
}

</style>
