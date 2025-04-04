<template>
  <AposContextMenuDialog
    menu-placement="top"
    class-list="apos-rich-text-toolbar"
    :has-tip="false"
  >
    <div class="apos-rich-text-toolbar__inner">
      <AposTiptapButton
        v-for="(item, index) in actions"
        :key="item.label + '-' + index"
        :name="item.label"
        :tool="item"
        :editor="editor"
      />
    </div>
  </AposContextMenuDialog>
</template>

<script>

export default {
  name: 'AposTiptapTableControls',
  props: {
    editor: {
      type: Object,
      required: true
    }
  },
  computed: {
    actions() {
      return [
        {
          command: 'addRowAfter',
          label: 'apostrophe:addRowAfter',
          icon: 'table-row-plus-after-icon',
          iconSize: 20
        },
        {
          command: 'addColumnAfter',
          label: 'apostrophe:addColumnAfter',
          icon: 'table-column-plus-after-icon',
          iconSize: 20
        },
        {
          command: 'deleteRow',
          label: 'apostrophe:deleteRow',
          icon: 'table-row-remove-icon',
          iconSize: 20
        },
        {
          command: 'deleteColumn',
          label: 'apostrophe:deleteColumn',
          icon: 'table-column-remove-icon',
          iconSize: 20
        },
        {
          command: 'mergeCells',
          label: 'apostrophe:mergeCells',
          icon: 'table-merge-cells-icon',
          iconSize: 20
        },
        {
          command: 'splitCell',
          label: 'apostrophe:splitCell',
          icon: 'table-split-cell-icon',
          iconSize: 20
        },
        {
          command: 'toggleHeaderColumn',
          label: 'apostrophe:toggleHeaderColumn',
          icon: 'table-column-icon',
          iconSize: 20
        },
        {
          command: 'toggleHeaderRow',
          label: 'apostrophe:toggleHeaderRow',
          icon: 'table-row-icon',
          iconSize: 20
        },
        {
          command: 'insertTable',
          label: 'apostrophe:insertTable',
          icon: 'table-plus-icon',
          iconSize: 20
        },
        {
          command: 'deleteTable',
          label: 'apostrophe:deleteTable',
          icon: 'table-minus-icon',
          iconSize: 20
        }
      ].filter(action => this.editor.can()[action.command]());
    }
  }
};
</script>

<style lang="scss" scoped>
  .apos-rich-text-toolbar__inner {
    gap: 8px;
    display: flex
  }

  .apos-rich-text-toolbar :deep(.apos-button--rich-text.apos-button--icon-only) {
    width: 30px;
  }
</style>
