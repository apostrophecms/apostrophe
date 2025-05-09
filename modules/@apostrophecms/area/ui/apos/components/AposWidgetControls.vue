<template>
  <div class="apos-area-modify-controls">
    <AposButtonGroup :modifiers="[ 'vertical' ]">
      <div
        v-for="{
          action,
          disabled,
          icon,
          label,
          tooltip,
          operations,
          ...rest
        } in activeOperations"
        :key="action"
      >
        <AposButton
          v-if="!operations"
          :label="label"
          :action="action"
          :icon="icon"
          :disabled="disabled"
          :tooltip="tooltip"

          :icon-only="true"
          type="group"
          :modifiers="[ 'small', 'inline' ]"
          role="menuitem"
          class="apos-area-modify-controls__button"
          :icon-size="16"
        />
        <!--
          disable-focus="!this.tabbable"
          @click="handleClick(control)"
          @click="executeOperation({ action, label, ...rest })"
        -->
        <AposContextMenu
          v-else
          :button="{
            label,
            icon,
            iconOnly: true,
            type: 'subtle',
            modifiers: ['small', 'no-motion']
          }"
          :disabled="disabled"
          :menu="operations"
          :has-tip="false"
          menu-placement="left"
          class="apos-admin-bar_context-button"
        />
        <!--
          @item-clicked="handleClick"
          @item-clicked="(item) => beginGroupedOperation(item, operations)"
        -->

        <!--
        <AposButton
          v-bind="widgetRemoveControl"
          @click="handleClick({ action: 'remove' })"
        />
        -->
      </div>
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
    }
  },
  emits: [ 'remove', 'edit', 'cut', 'copy', 'clone', 'up', 'down', 'update' ],
  data() {
    const moduleOptions = apos.modules[apos.area.widgetManagers[this.modelValue.type]];
    const { widgetOperations = [] } = moduleOptions || {};

    return {
      activeOperations: [],
      widgetOperations
    };
  },
  computed: {
    computeActiveOperations () {
      this.activeOperations = this.widgetOperations
        .map(({ operations, ...rest }) => {
          if (!operations) {
            return {
              ...rest,
              operations
            };
          }

          return {
            operations,
            ...rest
          };
          // return {
          //   operations: operations.filter((op) => this.isOperationActive(op)),
          //   ...rest
          // };
        });// .filter((operation) => {
      //   if (operation.operations && !operation.operations.length) {
      //     return false;
      //   }
      //
      //   return this.isOperationActive(operation);
      // });
    },
    isOperationActive (operation) {
      return Object.entries(operation.if || {})
        .every(([ filter, val ]) => {
          return false;
          if (Array.isArray(val)) {
            // return val.includes(this.filterValues[filter]);
            return true;
          }

          // return this.filterValues[filter] === val;
          return true;
        });
    },
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
    }
  },
  methods: {
    async handleClick({ action, modal }) {
      if (action) {
        this.$emit(action);
      }
      if (modal) {
        const result = await apos.modal.execute(modal, {
          widget: this.modelValue,
          widgetSchema: apos.modules[
            apos.area.widgetManagers[this.modelValue.type]
          ]?.schema
        });
        if (result) {
          // TODO: make sure the update method from
          // modules/@apostrophecms/area/ui/apos/components/AposAreaEditor.vue
          // does the job and does not mess with the widget type and _id:
          this.$emit('update', result);
        }
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
