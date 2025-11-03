<template>
  <div class="apos-area-modify-controls">
    <AposButtonGroup :modifiers="[ 'vertical' ]">
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
        identifier="secondary-controls"
        :has-tip="false"
        :button="{
          label: 'apostrophe:moreOptions',
          icon: 'dots-horizontal-icon',
          iconOnly: true,
          type: 'subtle',
          modifiers: ['small', 'no-motion']
        }"
        @item-clicked="handleClick"
      />

      <AposButton
        v-if="widgetRemoveControl"
        v-bind="widgetRemoveControl"
        @click="handleClick(widgetRemoveControl)"
      />
    </AposButtonGroup>
  </div>
</template>

<script>

import checkIfConditions from 'apostrophe/lib/universal/check-if-conditions.mjs';
import { isOperationDisabled, getOperationTooltip } from '../lib/operations.js';

const standaloneWidgetOperation = [ 'remove' ];

export default {
  props: {
    modelValue: {
      type: Object,
      required: true
    },
    index: {
      type: Number,
      required: true
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
    },
    widgetOptions: {
      type: Object,
      required: true
    }
  },
  emits: [ 'update', 'operation' ],
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
      // Custom widget operations displayed in the primary controls
      return this.widgetPrimaryOperations.map(operation => {
        const disabled = this.disabled || isOperationDisabled(operation, this.$props);
        const tooltip = getOperationTooltip(operation, { disabled });
        return {
          ...this.widgetDefaultControl,
          ...operation,
          disabled,
          tooltip
        };
      });
    },
    widgetSecondaryControls() {
      const renderOperation = (operation) => {
        const disabled = this.disabled ||
            (operation.disabledIfProps &&
            checkIfConditions(this.$props, operation.disabledIfProps));

        return {
          ...operation,
          modifiers: [
            ...disabled ? [ 'disabled' ] : []
          ]
        };
      };
      const controls = this.widgetNativeSecondaryOperations.map(renderOperation);

      if (!this.widgetCustomSecondaryOperations.length) {
        return controls;
      }

      controls.push({
        separator: true
      });

      // Custom widget operations displayed in the secondary controls
      return controls.concat(this.widgetCustomSecondaryOperations.map(renderOperation));
    },
    widgetRemoveControl() {
      const { widgetOperations = [] } = this.moduleOptions;
      const removeWidgetOperation = widgetOperations
        .find((operation) => operation.name === 'remove');
      if (!removeWidgetOperation) {
        return null;
      }

      const disabled = this.disabled || isOperationDisabled(removeWidgetOperation);
      const tooltip = getOperationTooltip(removeWidgetOperation, { disabled });
      return {
        ...this.widgetDefaultControl,
        ...removeWidgetOperation,
        disabled,
        tooltip
      };
    },
    widgetPrimaryOperations() {
      return this.getOperations({ secondaryLevel: false });
    },
    widgetNativeSecondaryOperations() {
      return this.getOperations({
        secondaryLevel: true,
        native: true
      });
    },
    widgetCustomSecondaryOperations() {
      return this.getOperations({
        secondaryLevel: true,
        native: false
      });
    },
    moduleOptions() {
      return apos.modules[apos.area.widgetManagers[this.modelValue.type]] ?? {};
    }
  },
  methods: {
    getOperations({ secondaryLevel, native }) {
      const { widgetOperations = [] } = this.moduleOptions;
      return widgetOperations.filter(operation => {
        if (standaloneWidgetOperation.includes(operation.name)) {
          return false;
        }
        if (
          typeof native === 'boolean' &&
          ((native && !operation.nativeAction) || (!native && operation.nativeAction))
        ) {
          return false;
        }
        if (
          (secondaryLevel && !operation.secondaryLevel) ||
          (!secondaryLevel && operation.secondaryLevel)
        ) {
          return false;
        }
        if (operation.if && !checkIfConditions(this.modelValue, operation.if)) {
          return false;
        }
        return operation;
      }).map(operation => ({
        action: operation.action || operation.name,
        ...operation
      }));
    },
    async handleClick({
      modal, action, nativeAction, ignoreResult = false
    }) {
      if (modal) {
        const result = await apos.modal.execute(modal, {
          widget: this.modelValue,
          widgetSchema: apos.modules[
            apos.area.widgetManagers[this.modelValue.type]
          ]?.schema,
          widgetOptions: this.widgetOptions
        });
        if (result && !ignoreResult) {
          this.$emit('update', result);
        }
        return;
      }
      const payload = {
        widgetId: this.modelValue._id,
        index: this.index
      };
      if (nativeAction) {
        this.$emit('operation', {
          name: nativeAction,
          payload
        });
        return;
      }

      if (action) {
        apos.bus.$emit(action, payload);
      }
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

  :deep(.apos-context-menu__items) {
    min-width: 250px;
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
