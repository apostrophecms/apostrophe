<template>
  <ol
    v-if="widgetBreadcrumbActions.length > 0"
    class="apos-breadcrumb-operations apos-area-widget__breadcrumbs apos-area-widget__breadcrumbs--action"
    data-apos-test="widget-breadcrumb-actions"
  >
    <li class="apos-area-widget__breadcrumb">
      <component
        :is="operation.component"
        v-for="operation in widgetBreadcrumbActions"
        :key="operation.key"
        v-slot="slotProps"
        v-bind="operation.props"
        :data-operation-id="operation.key"
        :data-apos-test-name="operation.name"
        :data-apos-test-action="operation.action"
        :data-apos-test-type="operation.type"
        v-on="operation.listeners"
      >
        <component
          :is="operation.modal"
          v-if="operation.type === 'menu' && operation.modal"
          :widget="widget"
          :widget-schema="widgetModuleOptions.schema"
          data-apos-test="operation-modal"
          @update="$emit('update', $event)"
          @close="slotProps.close"
        />
      </component>
    </li>
  </ol>
  <ol
    v-if="!skipInfo && widgetBreadcrumbInfos.length > 0"
    class="apos-area-widget__breadcrumbs apos-area-widget__breadcrumbs--info"
    data-apos-test="widget-breadcrumb-infos"
  >
    <li>
      <component
        :is="operation.component"
        v-for="operation in widgetBreadcrumbInfos"
        :key="`info-${operation.key}`"
        :data-apos-test-name="operation.name"
        v-bind="operation.props"
        v-on="operation.listeners"
      />
    </li>
  </ol>
</template>

<script>
import { mapActions } from 'pinia';
import { useWidgetStore } from 'Modules/@apostrophecms/ui/stores/widget';
import { isOperationDisabled, getOperationTooltip } from '../lib/operations.js';

export default {
  name: 'AposBreadcrumbOperations',
  props: {
    i: {
      type: Number,
      required: true
    },
    tinyScreen: {
      type: Boolean,
      default: false
    },
    options: {
      type: Object,
      default() {
        return {};
      }
    },
    widget: {
      type: Object,
      default() {
        return {};
      }
    },
    isFocused: {
      type: Boolean,
      default: false
    },
    disabled: {
      type: Boolean,
      default: false
    },
    skipInfo: {
      type: Boolean,
      default: false
    },
    // Whether to teleport menu modals to the end of the document body.
    teleportModals: {
      type: Boolean,
      default: false
    }
  },
  emits: [
    'update',
    'operation',
    'widget-focus'
  ],
  data() {
    return {
      widgets: this.options.widgets || {}
    };
  },
  computed: {
    operationButtonDefault() {
      return {
        iconOnly: true,
        icon: 'plus-icon',
        type: 'group',
        modifiers: [ 'small', 'inline' ],
        role: 'menuitem',
        class: 'apos-area-modify-controls__button',
        iconSize: 16,
        disableFocus: !this.isFocused
      };
    },
    widgetOptions() {
      return this.widgets[this.widget.type];
    },
    isContextual() {
      return this.moduleOptions.widgetIsContextual[this.widget.type];
    },
    // Browser options from the `@apostrophecms/area` module.
    moduleOptions() {
      return window.apos.area;
    },
    widgetModuleOptions() {
      return apos.modules[this.moduleOptions?.widgetManagers[this.widget?.type]] ?? {};
    },
    widgetBreadcrumbOperations() {
      return (this.widgetModuleOptions.widgetBreadcrumbOperations || [])
        .map((operation) => ({
          component: this.getOperationComponent(operation),
          props: this.getOperationProps(operation),
          listeners: this.getOperationListeners(operation),
          name: operation.name || null,
          action: operation.action || null,
          key: operation.name,
          type: operation.type,
          modal: operation.modal || null
        }));
    },
    widgetBreadcrumbActions() {
      return this.widgetBreadcrumbOperations.filter(op => op.type !== 'info');
    },
    widgetBreadcrumbInfos() {
      return this.widgetBreadcrumbOperations.filter(op => op.type === 'info');
    }
  },
  methods: {
    ...mapActions(useWidgetStore, [ 'setFocusedWidget' ]),
    getOperationComponent(operation) {
      if (operation.type === 'info') {
        return 'AposIndicator';
      }
      if (operation.type === 'switch') {
        return 'AposBreadcrumbSwitch';
      }
      if (operation.type === 'menu') {
        return 'AposContextMenu';
      }
      return 'AposButton';
    },
    getOperationProps(operation) {
      const disabled = this.disabled || isOperationDisabled(operation, this.$props);
      const tooltip = getOperationTooltip(operation, {
        disabled,
        placement: 'bottom'
      });

      if (operation.type === 'info') {
        return {
          fillColor: 'var(--a-primary)',
          icon: operation.icon,
          tooltip: operation.tooltip,
          disabled
        };
      }

      if (operation.type === 'switch') {
        const choices = operation.choices.map((choice) => {
          const disabled = isOperationDisabled(choice, this.$props);
          const tooltip = getOperationTooltip(choice, {
            disabled,
            placement: 'bottom'
          });
          return {
            ...choice,
            disabled,
            tooltip
          };
        });
        return {
          widgetId: this.widget._id,
          name: operation.name,
          choices,
          value: operation.def,
          class: 'apos-area-widget--switch',
          disabled,
          tooltip
        };
      }

      if (operation.type === 'menu') {
        return {
          button: {
            ...this.operationButtonDefault,
            icon: operation.icon
          },
          teleportContent: this.teleportModals,
          disabled,
          tooltip
        };
      }

      return {
        ...this.operationButtonDefault,
        icon: operation.icon,
        action: operation.action,
        tooltip: operation.tooltip || null
      };
    },
    getOperationListeners(operation) {
      const listeners = {};
      const handleClick = [ 'info', undefined ].includes(operation.type);
      const setFocus = [ 'info', 'switch', undefined ].includes(operation.type) &&
        operation.action !== 'remove';

      if (operation.type === 'info') {
        return listeners;
      }
      if (operation.type === 'switch') {
        listeners.update = (payload) => {
          this.emitOperation(operation, payload);
        };
      }
      if (operation.type === 'menu') {
        listeners.open = (e) => {
          this.getFocus(e, this.widget._id);
        };
      }

      if (operation.rawEvents?.length) {
        // raw events such as mouseover, mouseout, mouseup, etc.
        operation.rawEvents.forEach((raw) => {
          listeners[raw] = (event) => {
            this.emitOperation(operation, {
              event,
              eventName: raw
            });
          };
        });

        return listeners;
      }

      if (!handleClick) {
        return listeners;
      }

      listeners.click = (e) => {
        this.handleOperationClick(operation);
        setFocus && this.getFocus(e, this.widget._id);
      };

      return listeners;
    },
    async handleOperationClick(operation) {
      const { modal } = operation;
      if (modal && operation.type !== 'menu') {
        const result = await apos.modal.execute(modal, {
          widget: this.widget,
          widgetSchema: this.widgetModuleOptions.schema
        });
        if (result) {
          this.$emit('update', result);
        }
        return;
      }

      this.emitOperation(operation);
    },
    emitOperation(operation, data = {}) {
      const payload = {
        widgetId: this.widget._id,
        index: this.i,
        data
      };

      if (operation.nativeAction) {
        this.$emit('operation', {
          name: operation.nativeAction,
          payload
        });
        return;
      }

      if (operation.action) {
        apos.bus.$emit(operation.action, payload);
      }
    },

    getFocus(e, _id) {
      this.$emit('widget-focus', e, _id);
    }
  }
};
</script>

<style lang="scss" scoped>
.apos-area-widget__breadcrumbs.apos-breadcrumb-operations {
  margin-left: 10px;
}

.apos-area-widget__breadcrumbs.apos-area-widget__breadcrumbs--action {
  padding: 4px;
  border: 1px solid var(--a-primary-transparent-25);
  background-color: var(--a-white);

  .apos-area-widget__breadcrumb,
  .apos-area-widget--switch,
  :deep(.apos-breadcrumb-switch),
  :deep(.apos-breadcrumb-switch > div) {
    height: 100%;
  }

  .apos-area-widget__breadcrumb {
    padding: 0;
  }

  > li {
    display: flex;
    align-items: center;
    margin: 0;
    padding: 0;

  }
}

.apos-area-widget__breadcrumbs.apos-area-widget__breadcrumbs--info {
  display: flex;
  border: none;
  background-color: transparent;

  > li {
    display: flex;
    align-items: center;
    gap: 5px;
    margin: 0;
    padding: 0;

  }
}

// Original breadcrumb styles, copy from AposAreaWidget.vue

.apos-area-widget__breadcrumbs {
  @include apos-list-reset();

  & {
    display: flex;
    box-sizing: border-box;
    align-items: center;
    height: 32px;
    margin: 0 0 8px;
    padding: 4px 6px;
    border: 1px solid var(--a-primary-transparent-50);
    background-color: var(--a-background-primary);
    border-radius: 8px;
  }
}

.apos-area-widget__breadcrumb {
  padding: 2px;
  white-space: nowrap;
  transition: background-color 300ms var(--a-transition-timing-bounce);
}

.apos-area-widget__breadcrumb,
.apos-area-widget__breadcrumb :deep(.apos-button__content) {
  @include type-help;

  & {
    padding: 2px;
    white-space: nowrap;
    color: var(--a-base-1);
    transition: background-color 300ms var(--a-transition-timing-bounce);
  }
}

.apos-area-widget__breadcrumbs:hover .apos-area-widget__breadcrumb,
.apos-area-widget__breadcrumbs:hover .apos-area-widget__breadcrumb
  :deep(.apos-button__content) {
  color: var(--a-text-primary);
}

.apos-area-widget__breadcrumb--widget-icon {
  margin-right: 2px;
  padding: 3px 2px 2px;
  color: var(--a-primary);
  transition: background-color 300ms var(--a-transition-timing-bounce);
  background-color: var(--a-primary-transparent-10);
  border-radius: 4px;
}

.apos-area-widget__breadcrumbs:hover .apos-area-widget__breadcrumb--widget-icon {
  background-color: var(--a-primary-transparent-25);
}

.apos-area-widget__breadcrumb--icon {
  padding: 2px;
  color: var(--a-text-primary);
}
</style>
