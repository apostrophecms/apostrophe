<template>
  <div class="apos-tiptap-select">
    <!-- "current" is just a hack to make it easy to reset to no selection after an action -->
    <select
      v-model="current"
      class="apos-tiptap-control apos-tiptap-control--select"
      @change="takeAction"
    >
      <option
        v-for="action in actions"
        :key="action.name"
        :value="action.name"
      >
        {{ $t(action.label) }}
      </option>
    </select>
    <chevron-down-icon
      :size="11"
      class="apos-tiptap-select__icon"
      fill-color="currentColor"
    />
  </div>
</template>

<script>

export default {
  name: 'AposTiptapTable',
  props: {
    name: {
      type: String,
      required: true
    },
    editor: {
      type: Object,
      required: true
    },
    tool: {
      type: Object,
      required: true
    },
    options: {
      type: Object,
      default() {
        return {};
      }
    }
  },
  data() {
    return {
      current: ''
    };
  },
  computed: {
    actions() {
      return [
        {
          // This is effectively the dropdown label
          name: '',
          label: 'apostrophe:table'
        },
        ...([
          {
            name: 'addRowBefore',
            label: 'apostrophe:addRowBefore'
          },
          {
            name: 'addRowAfter',
            label: 'apostrophe:addRowAfter'
          },
          {
            name: 'deleteRow',
            label: 'apostrophe:deleteRow'
          },
          {
            name: 'addColumnBefore',
            label: 'apostrophe:addColumnBefore'
          },
          {
            name: 'addColumnAfter',
            label: 'apostrophe:addColumnAfter'
          },
          {
            name: 'deleteColumn',
            label: 'apostrophe:deleteColumn'
          },
          {
            name: 'mergeCells',
            label: 'apostrophe:mergeCells'
          },
          {
            name: 'splitCell',
            label: 'apostrophe:splitCell'
          },
          {
            name: 'toggleHeaderColumn',
            label: 'apostrophe:toggleHeaderColumn'
          },
          {
            name: 'toggleHeaderRow',
            label: 'apostrophe:toggleHeaderRow'
          },
          {
            name: 'toggleHeaderCell',
            label: 'apostrophe:toggleHeaderCell'
          },
          // Late in the list so people don't nest tables by accident
          {
            name: 'insertTable',
            label: 'apostrophe:insertTable'
          },
          // Last to prevent accidental loss (although you can undo)
          {
            name: 'deleteTable',
            label: 'apostrophe:deleteTable'
          }
        ].filter(action => this.editor.can()[action.name]()))
      ];
    },
    moduleOptions() {
      return window.apos.modules['@apostrophecms/rich-text-widget'];
    }
  },
  methods: {
    takeAction() {
      const action = this.current;
      this.editor.commands.focus();
      if (action === 'insertTable') {
        // Reach into prosemirror for current selection,
        // then turn it into a cursor position only so we don't
        // delete the existing selection which would mean
        // you can only create a table by deleting some work
        this.editor.commands.setTextSelection(this.editor.view.state.selection.$anchor.pos);
      }
      this.editor.commands[action]();
      // We are using the select as a menu of one-time actions, it's not really a persisted value
      this.current = '';
    }
  }
};
</script>

<style lang="scss" scoped>
  // "If another select el is needed for the rich-text toolbar these styles should be made global."
  // ... And here we are, but first let's see if we decide to rebuild this UI without the menu. -Tom

  .apos-tiptap-control--select {
    @include apos-button-reset();
    @include type-small;

    & {
      height: 100%;
      padding: 0 15px 0 10px;
    }

    &:focus, &:active {
      background-color: var(--a-base-9);
      outline: none;
    }

    &:hover {
      background-color: var(--a-base-8);
    }
  }

  .apos-tiptap-select {
    position: relative;
  }

  .apos-tiptap-select :deep(.apos-tiptap-select__icon) {
    position: absolute;
    top: 50%;
    right: 5px;
    transform: translateY(-50%);
    height: 11px;
    pointer-events: none;
  }
</style>
