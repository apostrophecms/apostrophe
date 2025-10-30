<template>
  <div
    v-click-outside-element="resetFocusedArea"
    :data-apos-area="areaId"
    data-tablet-full="true"
    class="apos-area"
    :class="themeClass"
    :style="{
      '--colspan': gridModuleOptions.columns,
      '--colstart': 1,
      '--justify': 'stretch',
      '--align': 'stretch'
    }"
    @click="setFocusedArea(areaId, $event)"
  >
    <div
      v-if="next.length === 0 && !foreign"
      class="apos-empty-area"
      tabindex="0"
      @paste="paste(0)"
      @click="setFocusedArea(areaId, $event)"
    >
      <template v-if="isEmptySingleton">
        <AposButton
          :label="{
            key: 'apostrophe:addWidgetType',
            label: $t(contextMenuOptions.menu[0].label)
          }"
          :disabled="field && field.readOnly"
          :disable-focus="false"
          type="primary"
          :icon="icon"
          @click="add({ index: 0, name: contextMenuOptions.menu[0].name })"
        />
      </template>
      <template v-else>
        <AposAreaMenu
          :context-menu-options="contextMenuOptions"
          :field-id="fieldId"
          :empty="true"
          :index="0"
          :options="options"
          :max-reached="maxReached"
          :disabled="field && field.readOnly"
          :widget-options="options.widgets"
          :tabbable="true"
          :open="false"
          @add="add"
        />
      </template>
    </div>
    <div class="apos-areas-widgets-list">
      <AposGridLayout
        :options="gridModuleOptions"
        :items="layoutColumnWidgets"
        :meta="layoutMeta"
        :layout-mode="layoutMode"
        :device-mode="layoutDeviceMode"
        :opstate="{
          options: options,
          disabled: field && field.readOnly,
          operations: layoutBreadcrumbOperations
        }"
        data-apos-test="theGridLayout"
        @click="clickOnGrid"
        @resize-start="emphasizeGrid"
        @move-start="emphasizeGrid"
        @resize-end="onResizeOrMoveEnd"
        @move-end="onResizeOrMoveEnd"
        @add-fit-item="onAddFitItem"
        @patch-item="layoutPatchFull"
      >
        <template #item="{ item: widget }">
          <AposAreaWidget
            :key="widget._id"
            :area-id="areaId"
            :widget="widget"
            :meta="meta[widget._id]"
            :generation="generation"
            :i="widget.__naturalIndex"
            :options="options"
            :next="next"
            :following-values="followingValues"
            :doc-id="docId"
            :context-menu-options="contextMenuOptions"
            :field-id="fieldId"
            :field="field"
            :disabled="field && field.readOnly"
            :widget-hovered="hoveredWidget"
            :widget-focused="focusedWidget"
            :max-reached="maxReached"
            :rendering="rendering(widget)"
            :controls-disabled="true"
            :breadcrumb-disabled="true"
            @up="up"
            @down="down"
            @remove="remove"
            @cut="cut"
            @copy="copy"
            @edit="edit"
            @clone="clone"
            @update="update"
            @add="add"
            @paste="paste"
          />
        </template>
      </AposGridLayout>
    </div>
  </div>
</template>

<script>
import { mapActions } from 'pinia';
import AposAreaEditorLogic from 'Modules/@apostrophecms/area/logic/AposAreaEditor.js';
import walkWidgets from 'Modules/@apostrophecms/area/lib/walk-widgets.js';
import { useWidgetStore } from 'Modules/@apostrophecms/ui/stores/widget.js';
import { provisionRow } from '../lib/grid-state.mjs';

export default {
  name: 'AposAreaLayoutEditor',
  mixins: [ AposAreaEditorLogic ],
  props: {
    moduleName: {
      type: String,
      default: null
    },
    parentOptions: {
      type: Object,
      default: () => ({})
    }
  },
  data() {
    return {
      // 'layout' | 'focus' | 'content'
      layoutMode: 'content',
      layoutDeviceMode: 'desktop'
    };
  },
  computed: {
    layoutModuleOptions() {
      return window.apos.modules[this.moduleName] || {};
    },
    gridModuleOptions() {
      return Object.assign(
        {},
        this.layoutModuleOptions.grid ?? {},
        this.parentOptions
      );
    },
    // Meta storage is not yet implemented, return a default meta object
    layoutMeta() {
      return {
        columns: this.gridModuleOptions.columns,
        desktop: {
          rows: 1
        },
        tablet: {
          rows: 1,
          auto: true
        },
        mobile: {
          rows: 1,
          auto: true
        }
      };
    },
    layoutColumnWidgets() {
      return this.next
        .map((w, index) => {
          w.__naturalIndex = index;
          return w;
        });
    },
    layoutColumnWidgetIds() {
      return this.layoutColumnWidgets.map(w => w._id);
    },
    layoutColumnWidgetDeepIds() {
      const ids = [];
      walkWidgets(
        this.layoutColumnWidgets,
        w => ids.push(w._id)
      );

      return ids;
    },
    layoutBreadcrumbOperations() {
      return (this.layoutModuleOptions.widgetBreadcrumbOperations || []);
    },
    hasLayoutColumnWidgets() {
      return this.layoutColumnWidgets.length > 0;
    },
    layoutColumnWidgetName() {
      return this.layoutModuleOptions.columnWidgetName;
    }
  },
  watch: {
    // Intercept the columns focus, and emphasize the layout widget instead.
    async focusedWidget(widgetId) {
      if (!widgetId || !this.parentOptions.widgetId) {
        return;
      }

      await this.$nextTick();
      if (widgetId === this.parentOptions.widgetId && this.layoutMode === 'layout') {
        this.setFocusedWidget(null, this.areaId);
        this.emphasizeGrid();
        return;
      }

      if (this.layoutColumnWidgetDeepIds.includes(widgetId)) {
        this.emphasizeGrid();
      } else {
        this.deEmphasizeGrid();
      }
    },
    // Steal the columns hover, set it on the layout widget instead.
    hoveredWidget(widgetId) {
      if (
        this.parentOptions.widgetId &&
        this.layoutColumnWidgetIds.includes(widgetId)
      ) {
        this.setHoveredWidget(this.parentOptions.widgetId, this.areaId);
      }
    },
    layoutMode(newMode) {
      if (newMode === 'layout') {
        this.setFocusedWidget(null, this.areaId);
        this.emphasizeGrid();
      } else {
        this.setFocusedWidget(this.parentOptions.widgetId, this.areaId);
        this.deEmphasizeGrid();
      }
    }
  },
  mounted() {
    apos.bus.$on('apos-switch-layout-mode', this.switchLayoutMode);
    apos.bus.$on('apos-layout-col-delete', this.onRemoveLayoutColumn);
    if (!this.hasLayoutColumnWidgets) {
      this.onCreateProvision();
    }
    this.updateWidget(this.parentOptions?.widgetId, 'layout:switch', this.layoutMode);
  },
  beforeUnmount() {
    apos.bus.$off('apos-switch-layout-mode', this.switchLayoutMode);
    apos.bus.$off('apos-layout-col-delete', this.onRemoveLayoutColumn);
  },
  methods: {
    ...mapActions(useWidgetStore, [
      'updateWidget',
      'setHoveredWidget',
      'addEmphasizedWidget',
      'removeEmphasizedWidget'
    ]),
    clickOnGrid() {
      if (this.parentOptions.widgetId) {
        this.setFocusedWidget(this.parentOptions.widgetId, this.areaId);
      }
    },
    emphasizeGrid() {
      if (this.parentOptions.widgetId) {
        this.addEmphasizedWidget(this.parentOptions.widgetId);
      }
    },
    deEmphasizeGrid() {
      if (this.parentOptions.widgetId) {
        this.removeEmphasizedWidget(this.parentOptions.widgetId);
      }
    },
    // While switching to Edit mode, areaEditors are mounted twice in a quick
    // succession. This leads to duplicate event listeners on the bus.
    // See the little trick below to avoid that.
    cleanRemovedWidget() {
      // isConnected is supported in all modern browsers (2020+).
      // It's the easiest way to check if the component is still in the DOM.
      // Here we eliminate leftover bus listeners from unmounted components, that happens
      // sometimes (mostly in development mode) when entering Edit mode with existing
      // area editors on the page.
      if (this.$el?.isConnected === false) {
        apos.bus.$off('apos-switch-layout-mode', this.switchLayoutMode);
        this.unbindEventListeners();

      }
    },
    switchLayoutMode({ widgetId, data }) {
      this.cleanRemovedWidget();
      if (!widgetId || widgetId !== this.parentOptions?.widgetId) {
        return;
      }
      this.layoutMode = data.value;
      this.updateWidget(widgetId, 'layout:switch', this.layoutMode);
    },
    onRemoveLayoutColumn({ widgetId }) {
      this.cleanRemovedWidget();
      const index = this.next.findIndex(w => w._id === widgetId);
      if (
        index < 0 ||
        this.next[index].type !== this.layoutColumnWidgetName
      ) {
        return;
      }
      return this.remove({ index });
    },
    async onCreateProvision() {
      if (this.hasLayoutColumnWidgets) {
        return;
      }

      this.layoutMode = 'content';
      this.updateWidget(this.parentOptions?.widgetId, 'layout:switch', 'content');

      const items = provisionRow(this.gridModuleOptions.columns, {
        minColspan: this.gridModuleOptions.minSpan,
        defaultColspan: this.gridModuleOptions.defaultSpan,
        row: 1
      });

      for (const [ index, item ] of items.entries()) {
        const widget = this.newWidget(this.layoutColumnWidgetName);
        Object.assign(widget[this.layoutDeviceMode], {
          colspan: item.colspan,
          colstart: item.colstart,
          rowstart: item.rowstart,
          rowspan: item.rowspan,
          order: item.order
        });
        this.insert({
          widget,
          index
        });
      }

      await this.$nextTick();
      this.clickOnGrid();
    },
    onAddItem(patch) {
      const widgetName = this.layoutColumnWidgetName;
      if (!widgetName) {
        throw new Error('No layout column widget found.');
      }
      const { _id, ...rest } = patch;
      const widget = this.newWidget(widgetName);
      Object.assign(widget[this.layoutDeviceMode], rest);
      const insert = {
        widget,
        index: this.layoutColumnWidgets.length
      };
      this.insert(insert);
      return insert;
    },
    onResizeOrMoveEnd(patchArr) {
      if (!patchArr?.length) {
        return;
      }
      this.layoutPatchMany(patchArr);
    },
    onAddFitItem(patchArr) {
      const widgetName = this.layoutColumnWidgetName;
      if (!widgetName) {
        throw new Error('No layout column widget found.');
      }
      const insert = patchArr.find(patch => {
        return !patch._id;
      });
      this.onAddItem(insert);
      this.layoutPatchMany(patchArr);
    },
    onRemoveItem({ _id, patches }) {
      const index = this.next.findIndex(w => w._id === _id);
      if (index !== -1 && this.next[index].type === this.layoutColumnWidgetName) {
        this.remove({ index });
      }
      this.layoutPatchMany(patches);
    },
    // Apply a partial widget patch, for only the current device mode
    layoutPatchOne(patch, device) {
      if (!patch || !patch._id) {
        return;
      }
      const widget = this.next.find(w => w._id === patch._id);
      if (widget?.type !== this.layoutColumnWidgetName) {
        return;
      }
      // IMPORTANT: The patch carries the widget _id,
      // this is not the same as the nested object _id in the widget.
      // Be sure to keep the existing internal _id's intact.
      const { _id, ...rest } = patch;
      Object.assign(widget[device || this.layoutDeviceMode], rest);
      // eslint-disable-next-line no-console
      this.update(widget).catch(console.error);
    },
    layoutPatchMany(patchArr) {
      const patches = patchArr.filter(patch => {
        return patch._id &&
          this.next.some(w => w._id === patch._id);
      });

      for (const patch of patches) {
        this.layoutPatchOne(patch);
      }
    },
    // Apply a full widget patch, including nested objects
    layoutPatchFull(patch) {
      const widget = this.next.find(w => w._id === patch._id);
      if (widget?.type !== this.layoutColumnWidgetName) {
        return;
      }

      const {
        _id, desktop = {}, tablet = {}, mobile = {}, ...rest
      } = patch;
      Object.assign(widget, rest);
      Object.assign(widget.desktop, desktop);
      Object.assign(widget.tablet, tablet);
      Object.assign(widget.mobile, mobile);

      // eslint-disable-next-line no-console
      this.update(widget).catch(console.error);
    }
  }
};
</script>

<style lang="scss" scoped>
.apos-empty-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 30px;
  border: 1px solid var(--a-base-8);
  min-height: 50px;
  background-color: var(--a-base-9);
  border-radius: var(--a-border-radius);

  &:focus, &:active {
    border-color: var(--a-primary);
  }
}
</style>
