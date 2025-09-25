<template>
  <ol
    v-if="widgetBreadcrumbActions.length > 0"
    class="apos-area-widget__breadcrumbs apos-area-widget__breadcrumbs--action"
    style="margin-left: 10px;"
    data-apos-test="widget-breadcrumb-actions"
  >
    <li class="apos-area-widget__breadcrumb">
      <component
        :is="operation.component"
        v-for="operation in widgetBreadcrumbActions"
        :key="operation.key"
        v-slot="slotProps"
        :data-apos-test-name="operation.name"
        :data-apos-test-action="operation.action"
        :data-apos-test-type="operation.type"
        v-bind="operation.props"
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
import { useWidgetStore } from 'Modules/@apostrophecms/ui/stores/widget';
import { mapState } from 'pinia';
import AposIndicator from 'Modules/@apostrophecms/ui/components/AposIndicator.vue';
import AposBreadcrumbSwitch from 'Modules/@apostrophecms/area/components/AposBreadcrumbSwitch.vue';

export default {
  name: 'AposBreadcrumbOperations',
  components: {
    AposIndicator,
    AposBreadcrumbSwitch
  },
  props: {
    i: {
      type: Number,
      required: true
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
    'operation'
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
          key: operation.action || operation.name,
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
      if (operation.type === 'info') {
        return {
          // class: 'apos-area-widget__breadcrumbs-switch__info',
          fillColor: 'var(--a-primary)',
          icon: operation.icon,
          tooltip: operation.tooltip
        };
      }

      if (operation.type === 'switch') {
        return {
          widgetId: this.widget._id,
          name: operation.name,
          choices: operation.choices,
          value: operation.def,
          class: 'apos-area-widget--switch'
        };
      }

      if (operation.type === 'menu') {
        return {
          button: {
            ...this.operationButtonDefault,
            icon: operation.icon
          },
          tooltip: operation.tooltip || null,
          teleportContent: this.teleportModals
        };
      }

      // Button by default
      return {
        ...this.operationButtonDefault,
        icon: operation.icon,
        action: operation.action,
        tooltip: operation.tooltip || null
      };
    },
    getOperationListeners(operation) {
      const listeners = {};
      let setFocus = true;
      let handleClick = true;
      if (operation.type === 'info') {
        return listeners;
      }
      if (operation.type === 'switch') {
        setFocus = true;
        handleClick = false;
        listeners.update = (payload) => {
          this.emitOperation(operation, payload);
        };
      }
      if (operation.type === 'menu') {
        setFocus = false;
        handleClick = false;
        // no-op, the modal is handled in the slot
        // and should emit 'update' when done
        listeners.open = (e) => {
          this.getFocus(e, this.widget._id);
        };
      }
      if (operation.action === 'remove') {
        setFocus = false;
      }

      if (!handleClick) {
        return listeners;
      }

      if (!listeners.click) {
        listeners.click = (e) => {
          this.handleOperationClick(operation);
          setFocus && this.getFocus(e, this.widget._id);
        };
      } else if (setFocus) {
        const originalClick = listeners.click;
        listeners.click = (e) => {
          originalClick(e);
          this.getFocus(e, this.widget._id);
        };
      }

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
    emitOperation(operation, payload = {}) {
      if (operation.action) {
        this.$emit('operation', {
          name: operation.action,
          payload: this.i
        });
      } else {
        apos.bus.$emit('widget-breadcrumb-operation', {
          ...payload,
          ...operation,
          _id: this.widget._id
        });
      }
    },

    getFocus(e, _id) {
      this.$emit('widget-focus', e, _id);
    }
  }
};
</script>

<style lang="scss" scoped>
// Limit breadcrumb styles to the control buttons, not modal content

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

// FIXME: this also overrides the modal button (when menu type is used)
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
