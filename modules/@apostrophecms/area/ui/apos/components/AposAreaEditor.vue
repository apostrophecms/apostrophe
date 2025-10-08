<template>
  <div
    v-click-outside-element="resetFocusedArea"
    :data-apos-area="areaId"
    class="apos-area"
    :class="themeClass"
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
          :empty="true"
          :index="0"
          :options="options"
          :field-id="fieldId"
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
      <AposAreaWidget
        v-for="(widget, i) in next"
        :key="widget._id"
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
        :max-reached="maxReached"
        :rendering="rendering(widget)"
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
    </div>
  </div>
</template>

<script>
import AposAreaEditorLogic from '../logic/AposAreaEditor.js';

export default {
  name: 'AposAreaEditor',
  mixins: [ AposAreaEditorLogic ]
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
