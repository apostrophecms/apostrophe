<template>
  <Transition name="apos-widget-selection">
    <div
      v-if="visible"
      class="apos-widget-controls-multiselect"
      :class="{ 'apos-widget-controls-multiselect--modal': inModal }"
      data-apos-ignore-unfocus="true"
      data-apos-test="widgetControlsMultiselect"
    >
      <AposButtonGroup :aria-labelledby="countId">
        <span
          :id="countId"
          class="apos-widget-controls-multiselect__count"
          aria-live="polite"
        >
          {{ $t('apostrophe:widgetsSelected', { count: selectedWidgetIds.length }) }}
        </span>
        <AposButton
          v-for="control in controls"
          :key="control.name"
          v-bind="control"
          @click="run(control)"
        />
      </AposButtonGroup>
    </div>
  </Transition>
</template>

<script>
import { createId } from 'apostrophe/lib/beneath.js';
import { mapState, mapActions } from 'pinia';
import { useWidgetStore } from 'Modules/@apostrophecms/ui/stores/widget';
import { useWidgetGraphStore } from 'Modules/@apostrophecms/ui/stores/widgetGraph';
import {
  commonBatchOperations,
  contiguousRange,
  outermostIds
} from 'Modules/@apostrophecms/area/lib/widget-selection.js';
import {
  widgetContext
} from 'Modules/@apostrophecms/area/lib/widget-selection-dom.js';
import { runWidgetBatch } from 'Modules/@apostrophecms/area/lib/batch-widgets.js';
import { getOperationTooltip } from 'Modules/@apostrophecms/area/lib/operations.js';

export default {
  name: 'AposWidgetControlsMultiselect',
  data() {
    return {
      countId: `apos-widget-selection-count-${createId()}`
    };
  },
  computed: {
    ...mapState(useWidgetStore, [
      'focusedWidget',
      'selectedWidgetIds',
      'selectionGraphKey',
      'selectionToolbarFocus',
      'selectionRevision'
    ]),
    visible() {
      return this.selectedWidgetIds.length > 1;
    },
    inModal() {
      const el = this.focusedWidget
        ? widgetContext(this.focusedWidget)?.el
        : null;
      return !!el?.closest('[data-apos-modal]');
    },
    graphKey() {
      return this.selectionGraphKey || window.apos.adminBar?.contextId || null;
    },
    effectiveIds() {
      return outermostIds(this.selectedWidgetIds, (id, ancestorId) => {
        return this.graphKey
          ? this.hasAncestor(this.graphKey, id, ancestorId)
          : false;
      });
    },
    moveRange() {
      // A move keeps the same ids, so this has to be read or the range
      // stays put after the widgets have changed places.
      if (this.selectionRevision < 0) {
        return null;
      }
      const ids = this.effectiveIds;
      if (!ids.length) {
        return null;
      }
      const contexts = ids.map((id) => widgetContext(id)).filter(Boolean);
      if (contexts.length !== ids.length) {
        return null;
      }
      const areaId = contexts[0].areaId;
      if (contexts.some((context) => context.areaId !== areaId)) {
        return null;
      }
      return contiguousRange(contexts[0].itemIds, ids);
    },
    controls() {
      const range = this.moveRange;
      const itemCount = range
        ? (widgetContext(this.effectiveIds[0])?.itemIds.length || 0)
        : 0;
      return this.commonOperations
        .filter((operation) => {
          const action = operation.nativeAction || operation.name;
          if (action === 'up') {
            return !!(range && range.first > 0);
          }
          if (action === 'down') {
            return !!(range && range.last < itemCount - 1);
          }
          return true;
        })
        .map((operation) => {
          return {
            ...this.buttonDefaults,
            ...operation,
            tooltip: getOperationTooltip({
              ...operation,
              tooltip: operation.tooltip || operation.label
            }, { placement: 'top' })
          };
        });
    },
    commonOperations() {
      const lists = this.selectedWidgetIds.map((id) => {
        return this.operationsFor(widgetContext(id)?.type);
      });
      const allowlist = window.apos.area?.batchWidgetOperations || [
        'up',
        'down',
        'remove',
        'cut',
        'copy',
        'clone'
      ];
      return commonBatchOperations(lists, allowlist);
    },
    buttonDefaults() {
      return {
        iconOnly: true,
        type: 'group',
        modifiers: [ 'small', 'inline' ],
        iconSize: 16
      };
    }
  },
  watch: {
    visible: {
      flush: 'pre',
      handler(visible) {
        if (visible) {
          this.focusBarIfControlsHadIt();
        }
      }
    }
  },
  methods: {
    ...mapActions(useWidgetStore, [ 'clearSelectionToolbarFocus' ]),
    ...mapActions(useWidgetGraphStore, {
      hasAncestor: 'hasAncestor'
    }),
    operationsFor(type) {
      if (!type) {
        return [];
      }
      const manager = window.apos.area?.widgetManagers?.[type];
      return window.apos.modules[manager]?.widgetOperations || [];
    },
    run(operation) {
      if (operation.modal) {
        return;
      }
      const nativeAction = operation.nativeAction;
      if ([ 'up', 'down', 'remove', 'cut', 'copy', 'clone' ].includes(nativeAction)) {
        this.runBatch(nativeAction);
        return;
      }
      if (operation.action) {
        for (const id of this.effectiveIds) {
          apos.bus.$emit(operation.action, { widgetId: id });
        }
      }
    },
    // The bar replaces the per-widget controls. If focus was in those
    // controls, put it on the first button here. Later clicks keep
    // whatever already has focus, because this only runs when the bar
    // first appears.
    focusBarIfControlsHadIt() {
      if (!this.selectionToolbarFocus) {
        return;
      }
      this.clearSelectionToolbarFocus();
      this.$nextTick(() => {
        const root = this.$el?.querySelector
          ? this.$el
          : document.querySelector('.apos-widget-controls-multiselect');
        root?.querySelector('button:not([disabled])')?.focus();
      });
    },
    runBatch(name) {
      const graphKey = this.graphKey;
      runWidgetBatch(name, {
        hasAncestor: (id, ancestorId) => {
          return graphKey ? this.hasAncestor(graphKey, id, ancestorId) : false;
        }
      });
    }
  }
};
</script>

<style lang="scss" scoped>
.apos-widget-controls-multiselect {
  z-index: $z-index-widget-selection;
  position: fixed;
  bottom: 24px;
  left: 50%;
  translate: -50% 0;

  &--modal {
    z-index: $z-index-widget-selection-modal;
  }

  &__count {
    @include type-base;

    & {
      align-self: center;
      padding: 0 10px 0 6px;
      border-right: 1px solid var(--a-primary-transparent-25);
      white-space: nowrap;
    }
  }

  :deep(.apos-button-group__inner) {
    border: 1px solid var(--a-primary-transparent-25);
    box-shadow: var(--a-box-shadow);
  }

  :deep(.apos-button-group) .apos-button {
    width: 32px;
    height: 32px;
    padding: 0;
    border: none;
    border-radius: var(--a-border-radius);
    background-color: transparent;
    color: var(--a-base-1);
  }
}

.apos-widget-selection-enter-active,
.apos-widget-selection-leave-active {
  transition: opacity 200ms ease, translate 200ms ease;
}

.apos-widget-selection-enter-from,
.apos-widget-selection-leave-to {
  opacity: 0;
  translate: -50% 16px;
}
</style>

<style lang="scss">
.apos-widget-marquee {
  z-index: $z-index-widget-selection;
  position: fixed;
  pointer-events: none;
  border: 1px solid var(--a-primary);
  background-color: var(--a-primary-transparent-25);

  &--modal {
    z-index: $z-index-widget-selection-modal;
  }
}
</style>
