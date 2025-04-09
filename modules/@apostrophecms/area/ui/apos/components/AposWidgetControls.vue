<template>
  <div class="apos-area-modify-controls">
    <AposButtonGroup
      v-if="!foreign"
      :modifiers="[ 'vertical' ]"
    >
      <AposButton
        v-for="control in widgetPrimaryControls"
        :key="control.action"
        v-bind="control"
        @click="handleClick(control)"
      />

      <AposContextMenu
        class="apos-admin-bar_context-button"
        :menu="widgetSecondaryControls"
        :disabled="disabled || (widgetSecondaryControls.length === 0)"
        menu-placement="left"
        :has-tip="false"
        :button="{
          tooltip: { content: 'apostrophe:moreOptions', placement: 'left' },
          label: 'apostrophe:moreOptions',
          icon: 'dots-horizontal-icon',
          iconOnly: true,
          type: 'subtle',
          modifiers: ['small', 'no-motion']
        }"
        @item-clicked="handleClick"
      />

      <AposButton
        v-bind="widgetRemoveControl"
        @click="handleClick({ action: 'remove' })"
      />
    </AposButtonGroup>
  </div>
</template>

<script>

export default {
  props: {
    modelValue: {
      type: Object,
      required: true
    },
    areaField: {
      type: Object,
      default: null
    },
    first: {
      type: Boolean,
      required: true
    },
    last: {
      type: Boolean,
      required: true
    },
    options: {
      type: Object,
      default() {
        return {};
      }
    },
    foreign: {
      type: Boolean,
      required: true
    },
    disabled: {
      type: Boolean,
      default: false
    },
    maxReached: {
      type: Boolean,
      default: false
    },
    tabbable: {
      type: Boolean,
      default: false
    }
  },
  emits: [ 'remove', 'edit', 'cut', 'copy', 'clone', 'up', 'down' ],
  data() {
    const { widgetOperations = [] } = apos.modules['@apostrophecms/area'];

    return {
      widgetPrimaryOperations: widgetOperations
        .filter(operation => !operation.secondaryLevel),
      widgetSecondaryOperations: widgetOperations
        .filter(operation => operation.secondaryLevel)
    };
  },
  computed: {
    widgetDefaultControl() {
      return {
        iconOnly: true,
        icon: 'plus-icon',
        type: 'group',
        modifiers: [ 'small', 'inline' ],
        role: 'menuitem',
        class: 'apos-area-modify-controls__button',
        iconSize: 16,
        disableFocus: !this.tabbable
      };
    },
    widgetPrimaryControls() {
      const controls = [];

      // Move up
      controls.push({
        ...this.widgetDefaultControl,
        label: 'apostrophe:nudgeUp',
        icon: 'arrow-up-icon',
        disabled: this.first || this.disabled,
        tooltip: {
          content: this.first || this.disabled ? null : 'apostrophe:nudgeUp',
          placement: 'left'
        },
        action: 'up'
      });

      // Move down
      controls.push({
        ...this.widgetDefaultControl,
        label: 'apostrophe:nudgeDown',
        icon: 'arrow-down-icon',
        disabled: this.last || this.disabled,
        tooltip: {
          content: this.last || this.disabled ? null : 'apostrophe:nudgeDown',
          placement: 'left'
        },
        action: 'down'
      });

      // Edit
      if (!this.options.contextual) {
        controls.push({
          ...this.widgetDefaultControl,
          label: 'apostrophe:edit',
          icon: 'playlist-edit-icon',
          disabled: this.disabled,
          tooltip: {
            content: 'apostrophe:editWidget',
            placement: 'left'
          },
          action: 'edit'
        });
      }

      // Custom widget operations displayed in the primary controls
      controls.push(
        ...this.widgetPrimaryOperations.map(operation => ({
          ...this.widgetDefaultControl,
          ...operation,
          disabled: this.disabled,
          tooltip: {
            content: operation.label,
            placement: 'left'
          }
        }))
      );

      return controls;
    },
    widgetSecondaryControls() {
      const controls = [];

      // Cut
      controls.push({
        label: 'apostrophe:cut',
        icon: 'content-cut-icon',
        action: 'cut'
      });

      // Copy
      controls.push({
        label: 'apostrophe:copy',
        icon: 'content-copy-icon',
        action: 'copy'
      });

      // Clone
      controls.push({
        label: 'apostrophe:duplicate',
        icon: 'content-duplicate-icon',
        action: 'clone',
        modifiers: [
          'separator',
          ...(this.disabled || this.maxReached) ? [ 'disabled' ] : []
        ]
      });

      // Custom widget operations displayed in the secondary controls
      controls.push(...this.widgetSecondaryOperations);

      return controls;
    },
    widgetRemoveControl() {
      return {
        ...this.widgetDefaultControl,
        label: 'apostrophe:remove',
        icon: 'trash-can-outline-icon',
        disabled: this.disabled,
        tooltip: {
          content: 'apostrophe:delete',
          placement: 'left'
        },
        action: 'remove'
      };
    }
  },
  methods: {
    handleClick({ action, modal }) {
      if (action) {
        this.$emit(action);
      }
      if (modal) {
        // FIXME: why is areaField empty?
        apos.modal.execute(modal, {
          widget: this.modelValue,
          field: this.areaField
        });
      }
    }
  }
};
</script>

<style lang="scss" scoped>
$z-index-button-background: 1;
$z-index-button-foreground: 2;

.apos-area-modify-controls {
  :deep(.apos-context-menu__items) .apos-context-menu__item {
    &:has(.apos-context-menu__button--separator):not(:last-child) {
      border-bottom: 1px solid var(--a-base-9);
    }
  }

  :deep(.apos-button__content) {
    z-index: $z-index-button-foreground;
    position: relative;
  }

  :deep(.apos-button__icon) {
    transition: all 300ms var(--a-transition-timing-bounce);
  }

  :deep(.apos-button) {
    background-color: transparent;

    &:not([disabled]):hover::after {
      background-color: var(--a-base-9);
    }

    &:active {
      background-color: transparent;
    }

    &:active .apos-button__icon {
      transform: scale(0.8);
    }

    &:active::after, &:focus::after {
      background-color: var(--a-primary-transparent-25);
    }

    &::after,
    &:not([disabled]):hover::after,
    &:not([disabled]):active::after,
    &:not([disabled]):focus::after {
      opacity: 1;
      transform: scale(1.15) translateY(0);
    }

    &::after {
      content: '';
      z-index: $z-index-button-background;
      position: absolute;
      top: 0;
      left: 0;
      display: block;
      width: 100%;
      height: 100%;
      background-color: transparent;
      transition:
        opacity 500ms var(--a-transition-timing-bounce),
        transform 500ms var(--a-transition-timing-bounce),
        background-color 500ms ease;
      opacity: 0;
      transform: scale(0.3) translateY(-4px);
    }
  }
}
</style>
