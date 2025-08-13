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
    <h5>A message from the Layout Area Editor</h5>
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
        :mode="'manage'"
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
    }
  },
  computed: {
    gridModuleOptions() {
      return window.apos.modules[this.moduleName]?.grid ?? {};
    },
    layoutColumnWidgets() {
      return this.next.filter(w => w.type !== '@apostrophecms/layout-meta');
    },
    layoutMeta() {
      return this.next.find(w => w.type === '@apostrophecms/layout-meta') ?? {};
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
