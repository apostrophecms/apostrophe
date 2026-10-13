<template>
  <div
    v-if="visible"
    ref="toolbar"
    class="apos-widget-selection-toolbar"
    :class="{ 'apos-widget-selection-toolbar--modal': inModal }"
    data-apos-ignore-unfocus="true"
    data-apos-test="widgetSelectionToolbar"
    :style="positionStyle"
  >
    <AposButtonGroup :modifiers="[ 'vertical' ]">
      <AposButton
        v-if="showIncludeContents"
        v-bind="includeContentsButton"
        @click="includeContents"
      />
      <AposButton
        v-for="control in controls"
        :key="control.name"
        v-bind="control"
        @click="run(control)"
      />
    </AposButtonGroup>
  </div>
</template>

<script>
import { mapState, mapActions } from 'pinia';
import { useWidgetStore } from 'Modules/@apostrophecms/ui/stores/widget';
import { useWidgetGraphStore } from 'Modules/@apostrophecms/ui/stores/widgetGraph';
import {
  commonBatchOperations,
  contiguousRange,
  includeDescendants,
  outermostIds
} from 'Modules/@apostrophecms/area/lib/widget-selection.js';
import {
  widgetContext
} from 'Modules/@apostrophecms/area/lib/widget-selection-dom.js';
import { runWidgetBatch } from 'Modules/@apostrophecms/area/lib/batch-widgets.js';
import { getOperationTooltip } from 'Modules/@apostrophecms/area/lib/operations.js';

export default {
  name: 'AposWidgetSelectionToolbar',
  data() {
    return {
      top: 0,
      left: 0,
      inModal: false
    };
  },
  computed: {
    ...mapState(useWidgetStore, [
      'focusedWidget',
      'focusedArea',
      'selectedWidgetIds',
      'selectionAnchorId',
      'pinnedWidgetIds',
      'selectionGraphKey',
      'selectionRevision'
    ]),
    visible() {
      return this.selectedWidgetIds.length > 1;
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
    showIncludeContents() {
      const graphKey = this.graphKey;
      if (!graphKey) {
        return false;
      }
      return this.selectedWidgetIds.some((id) => {
        return this.getDescendants(graphKey, id).length > 0;
      });
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
            tooltip: getOperationTooltip(operation)
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
    includeContentsButton() {
      return {
        ...this.buttonDefaults,
        name: 'includeContents',
        label: 'apostrophe:includeContents',
        icon: 'file-tree-icon',
        tooltip: {
          content: 'apostrophe:includeContents',
          placement: 'left'
        }
      };
    },
    buttonDefaults() {
      return {
        iconOnly: true,
        type: 'group',
        modifiers: [ 'small', 'inline' ],
        iconSize: 16
      };
    },
    positionStyle() {
      return {
        top: `${this.top}px`,
        left: `${this.left}px`
      };
    }
  },
  watch: {
    visible: {
      immediate: true,
      handler(visible) {
        if (visible) {
          this.$nextTick(this.place);
        }
      }
    },
    focusedWidget() {
      this.$nextTick(this.place);
    },
    selectionRevision() {
      this.$nextTick(this.place);
    }
  },
  mounted() {
    window.addEventListener('scroll', this.place, true);
    window.addEventListener('resize', this.place);
  },
  beforeUnmount() {
    window.removeEventListener('scroll', this.place, true);
    window.removeEventListener('resize', this.place);
  },
  methods: {
    ...mapActions(useWidgetStore, [ 'setWidgetSelection' ]),
    ...mapActions(useWidgetGraphStore, {
      hasAncestor: 'hasAncestor',
      getDescendants: 'getDescendants'
    }),
    operationsFor(type) {
      if (!type) {
        return [];
      }
      const manager = window.apos.area?.widgetManagers?.[type];
      return window.apos.modules[manager]?.widgetOperations || [];
    },
    place() {
      const el = this.$refs.toolbar;
      const id = this.focusedWidget;
      if (!this.visible || !el || !id) {
        return;
      }
      const widget = document.querySelector(`[data-apos-widget-id="${CSS.escape(id)}"]`);
      if (!widget) {
        return;
      }
      const rect = widget.getBoundingClientRect();
      const bar = window.apos.adminBar?.height || 0;
      const width = el.offsetWidth || 32;
      const height = el.offsetHeight || 32;
      const minTop = bar + 8;
      const maxTop = Math.max(minTop, window.innerHeight - height - 8);
      const maxLeft = Math.max(8, window.innerWidth - width - 8);
      this.top = Math.min(Math.max(rect.top + 16, minTop), maxTop);
      this.left = Math.min(Math.max(rect.right - width - 16, 8), maxLeft);
      this.inModal = !!widget.closest('[data-apos-modal]');
    },
    includeContents(event) {
      event?.stopPropagation?.();
      const graphKey = this.graphKey;
      const descendants = this.selectedWidgetIds.flatMap((id) => {
        return graphKey ? this.getDescendants(graphKey, id) : [];
      });
      const next = includeDescendants({
        selectedWidgetIds: this.selectedWidgetIds,
        selectionAnchorId: this.selectionAnchorId,
        pinnedWidgetIds: this.pinnedWidgetIds
      }, descendants);
      this.setWidgetSelection(next, {
        primaryId: this.focusedWidget,
        areaId: this.focusedArea,
        graphKey
      });
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
.apos-widget-selection-toolbar {
  z-index: $z-index-widget-selection;
  position: fixed;

  &--modal {
    z-index: $z-index-widget-selection-modal;
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
</style>
