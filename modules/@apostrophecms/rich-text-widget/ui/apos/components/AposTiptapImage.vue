<template>
  <div class="apos-image-control">
    <AposContextMenu
      class="apos-admin-bar__sub"
      menu-placement="bottom-end"
      :button="button"
      :keep-open-under-modals="true"
      @close="reset"
    >
      <AposImageControlDialog
        :editor="editor"
        :has-selection="hasSelection"
        @close="close"
      />
    </AposContextMenu>
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
      closeMenu: false
    };
  },
  computed: {
    button() {
      return {
        ...this.buttonActive ? { class: 'apos-is-active' } : {},
        type: 'rich-text',
        label: this.tool.label,
        'icon-only': Boolean(this.tool.icon),
        icon: this.tool.icon || false,
        'icon-size': this.tool.iconSize || 16,
        modifiers: [ 'no-border', 'no-motion' ],
        tooltip: {
          content: this.tool.label,
          placement: 'top',
          delay: 650
        }
      };
    },
    attributes() {
      return this.editor.getAttributes('image');
    },
    buttonActive() {
      return this.attributes.imageId;
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
    }
  },
  methods: {
    close() {
      this.editor.chain().focus();
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
