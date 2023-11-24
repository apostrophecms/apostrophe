<template>
  <div class="apos-image-control">
    <AposButton
      type="rich-text"
      @click="click"
      :class="{ 'apos-is-active': buttonActive }"
      :label="tool.label"
      :icon-only="!!tool.icon"
      :icon="tool.icon || false"
      :icon-size="tool.iconSize || 16"
      :modifiers="['no-border', 'no-motion']"
      :tooltip="{
        content: tool.label,
        placement: 'top',
        delay: 650
      }"
    />
    <AposImageControlDialog
      :active="active"
      :editor="editor"
      :has-selection="hasSelection"
      @close="close"
    />
  </div>
</template>

<script>
export default {
  name: 'AposTiptapImage',
  props: {
    tool: {
      type: Object,
      required: true
    },
    editor: {
      type: Object,
      required: true
    }
  },
  data() {
    return {
      active: false
    };
  },
  watch: {
    active(newVal, oldVal) {
      console.log({ key: 'watch:active(tiptapImage)', hasSelection: this.hasSelection, newVal, oldVal });
    },
    hasSelection(newVal, oldVal) {
      console.log({ key: 'watch:hasSelection', hasSelection: this.hasSelection, newVal, oldVal });
      if (!newVal) {
        this.close();
      }
    }
  },
  computed: {
    attributes() {
      return this.editor.getAttributes('image');
    },
    buttonActive() {
      return this.attributes.imageId || this.active;
    },
    hasSelection() {
      const { state } = this.editor;
      const { selection } = this.editor.state;

      // Text is selected
      const { from, to } = selection;
      const text = state.doc.textBetween(from, to, '');

      // Image node is selected
      const { content = [] } = selection.content().content;
      const [ { type } = {} ] = content;

      return text !== '' || type?.name === 'image';
    },
  },
  methods: {
    click() {
      console.log({ key: 'click', hasSelection: this.hasSelection, active: this.active });
      // this.editor.chain().focus();
      // this.editor.commands.focus();
      if (this.hasSelection) {
        this.active = !this.active;
      }
    },
    close() {
      console.log({ key: 'close', active: this.active });
      if (this.active) {
        this.active = false;
        this.editor.chain().focus();
      }
    }
  }
};
</script>

<style lang="scss" scoped>
  .apos-image-control {
    position: relative;
    display: inline-block;
  }

  .apos-is-active {
    background-color: var(--a-base-7);
  }
</style>
