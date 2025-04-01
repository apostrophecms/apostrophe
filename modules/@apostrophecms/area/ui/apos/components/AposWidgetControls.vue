<template>
  <div class="apos-area-modify-controls">
    <AposButtonGroup
      :modifiers="[ 'vertical' ]"
    >
      <AposButton
        v-for="control in widgetPrimaryControlsBefore"
        :key="control.action"
        v-bind="control"
        @click="handleClick(control.action)"
      />

      <!-- <AposContextMenu -->
      <!--   class="apos-admin-bar_context-button" -->
      <!--   :menu="menu" -->
      <!--   :disabled="disabled || (menu.length === 0)" -->
      <!--   menu-placement="bottom-end" -->
      <!--   :button="{ -->
      <!--     tooltip: { content: 'apostrophe:moreOptions', placement: 'bottom' }, -->
      <!--     label: 'apostrophe:moreOptions', -->
      <!--     icon: 'dots-horizontal-icon', -->
      <!--     iconOnly: true, -->
      <!--     type: 'subtle', -->
      <!--     modifiers: ['small', 'no-motion'] -->
      <!--   }" -->
      <!--   @item-clicked="menuHandler" -->
      <!--   @open="$emit('menu-open')" -->
      <!--   @close="$emit('menu-close')" -->
      <!-- /> -->

      <AposButton
        v-for="control in widgetPrimaryControlsAfter"
        :key="control.action"
        v-bind="control"
        @click="handleClick(control.action)"
      />

      <!-- <AposContextMenuDialog -->
      <!--   :menu-placement="placement" -->
      <!--   :class-list="classList" -->
      <!--   :menu="menu" -->
      <!--   :active-item="activeItem" -->
      <!--   :is-open="isOpen" -->
      <!--   @item-clicked="menuItemClicked" -->
      <!--   @set-arrow="setArrow" -->
      <!-- > -->
    </AposButtonGroup>
  </div>
</template>

<script>

export default {
  props: {
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
    widgetPrimaryControlsBefore() {
      if (this.foreign) {
        return [];
      }

      const { widgetOperations } = apos.modules['@apostrophecms/area'];
      console.log('widgetOperations', widgetOperations);

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

      /* // Cut */
      /* controls.push({ */
      /*   ...this.widgetDefaultControl, */
      /*   label: 'apostrophe:cut', */
      /*   icon: 'content-cut-icon', */
      /*   tooltip: { */
      /*     content: 'apostrophe:cut', */
      /*     placement: 'left' */
      /*   }, */
      /*   action: 'cut' */
      /* }); */
      /**/
      /* // Copy */
      /* controls.push({ */
      /*   ...this.widgetDefaultControl, */
      /*   label: 'apostrophe:copy', */
      /*   icon: 'clipboard-plus-outline-icon', */
      /*   tooltip: { */
      /*     content: 'apostrophe:copy', */
      /*     placement: 'left' */
      /*   }, */
      /*   action: 'copy' */
      /* }); */
      /**/
      /* // Clone */
      /* controls.push({ */
      /*   ...this.widgetDefaultControl, */
      /*   label: 'apostrophe:clone', */
      /*   icon: 'content-copy-icon', */
      /*   disabled: this.disabled || this.maxReached, */
      /*   tooltip: { */
      /*     content: 'apostrophe:duplicate', */
      /*     placement: 'left' */
      /*   }, */
      /*   action: 'clone' */
      /* }); */

      return controls;
    },
    widgetPrimaryControlsAfter() {
      if (this.foreign) {
        return [];
      }

      const controls = [];

      // Remove
      controls.push({
        ...this.widgetDefaultControl,
        label: 'apostrophe:remove',
        icon: 'trash-can-outline-icon',
        disabled: this.disabled,
        tooltip: {
          content: 'apostrophe:delete',
          placement: 'left'
        },
        action: 'remove'
      });

      return controls;
    }
  },
  methods: {
    handleClick(action) {
      console.log('action', action);
      this.$emit(action);
    }
  }
};
</script>

<style lang="scss" scoped>
$z-index-button-background: 1;
$z-index-button-foreground: 2;

.apos-area-modify-controls {
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
