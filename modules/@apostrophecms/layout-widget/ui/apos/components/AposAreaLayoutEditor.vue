<template>
  <div
    v-click-outside-element="resetFocusedArea"
    :data-apos-area="areaId"
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
    <div style="display: flex; align-items: center; justify-content: start; gap: 20px;">
      <AposInputBoolean
        v-model="layoutModes.manage"
        :modifiers="[ 'small' ]"
        :field="{
          name: 'manage',
          type: 'boolean',
          toggle: {
            'true': 'content',
            'false': 'layout'
          },
          def: true,
        }"
      />
      <!-- Device switch, next interations: <AposInputSelect
        v-model="layoutModes.device"
        :modifiers="[ 'small' ]"
        :field="{
          name: 'device',
          type: 'select',
          choices: [
            { label: $t('apostrophe:breakpointPreviewDesktop'), value: 'desktop' },
            { label: $t('apostrophe:breakpointPreviewTablet'), value: 'tablet' },
            { label: $t('apostrophe:breakpointPreviewMobile'), value: 'mobile' }
          ],
          def: 'desktop',
        }"
      /> -->
    </div>
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
      <AposGridManager
        :options="gridModuleOptions"
        :items="layoutColumnWidgets"
        :meta="layoutMeta"
        :layout-mode="layoutManageMode"
        :device-mode="layoutModes.device.data"
        @resize-end="onResizeEnd"
        @add-first-item="onAddItem"
        @add-fit-item="onAddFitItem"
        @remove-item="onRemoveItem"
        @patch-item="layoutPatchOne"
        @patch-device-item="layoutPatchDevice"
      >
        <template #item="{ item: widget, i }">
          <AposAreaWidget
            :area-id="areaId"
            :widget="widget"
            :meta="meta[widget._id]"
            :generation="generation"
            :i="i"
            :options="options"
            :next="next"
            :following-values="followingValues"
            :doc-id="docId"
            :context-menu-options="contextMenuOptions"
            :field-id="fieldId"
            :field="field"
            :disabled="field && field.readOnly"
            :widget-hovered="hoveredWidget"
            :non-foreign-widget-hovered="hoveredNonForeignWidget"
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
      </AposGridManager>
    </div>
  </div>
</template>

<script>
import AposAreaEditorLogic from 'Modules/@apostrophecms/area/logic/AposAreaEditor.js';

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
      layoutModes: {
        device: {
          data: 'desktop',
          error: false
        },
        manage: {
          data: true,
          error: false
        },
        manageFocused: {
          data: false,
          error: false
        }
      }
    };
  },
  computed: {
    gridModuleOptions() {
      return Object.assign(
        {},
        window.apos.modules[this.moduleName]?.grid ?? {},
        this.parentOptions
      );
    },
    layoutColumnWidgets() {
      return this.next.filter(w => w.type !== this.layoutMetaWidgetName);
    },
    layoutMeta() {
      return this.next.find(w => w.type === this.layoutMetaWidgetName) ?? {};
    },
    hasLayoutMeta() {
      return this.next.some(w => w.type === this.layoutMetaWidgetName);
    },
    // TODO this can be possible sent by server options.
    layoutMetaWidgetName() {
      return '@apostrophecms/layout-meta';
    },
    layoutColumnWidgetName() {
      return this.choices.find(c => c.name !== this.layoutMetaWidgetName)?.name;
    },
    layoutManageMode() {
      if (this.layoutModes.manage.data) {
        return 'view';
      }
      if (this.layoutModes.manageFocused.data) {
        return 'focus';
      }
      return 'manage';
    },
    layoutDeviceMode() {
      return this.layoutModes.device.data || 'desktop';
    }
  },
  watch: {
    layoutManageMode(newMode, oldMode) {
      if (newMode === 'view' && oldMode !== 'view') {
        this.layoutSort();
      }
    }
  },
  mounted() {
    if (!this.hasLayoutMeta) {
      this.onCreateProvision();
    }
  },
  methods: {
    // Sort by the desktop order so that the auto-layout works correctly.
    layoutSort() {
      const sorted = this.layoutColumnWidgets.sort((a, b) => {
        return (a.desktop.order || 0) - (b.desktop.order || 0);
      });

      // FIXME: this doesn't work, the array is never updated in the DB.
      this.next = [ this.layoutMeta, ...sorted ].filter(Boolean);
    },
    onResizeEnd(patchArr) {
      if (!patchArr?.length) {
        return;
      }
      this.layoutPatchMany(patchArr);
    },
    onCreateProvision() {
      if (!this.layoutMetaWidgetName) {
        throw new Error('No layout meta widget found.');
      }
      const meta = this.newWidget(this.layoutMetaWidgetName);
      meta.columns = this.gridModuleOptions.columns;
      this.insert({
        widget: meta,
        index: 0
      });
      this.layoutModes.manage.data = false;
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
        index: this.layoutColumnWidgets.length + 1
      };
      this.insert(insert);
      return insert;
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
        this.remove(index);
      }
      this.layoutPatchMany(patches);
    },
    layoutPatchDevice({
      _id, device, patch
    }) {
      if (!_id || !device || !patch) {
        return;
      }
      this.layoutPatchOne({
        _id,
        ...patch
      }, device);
    },
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
