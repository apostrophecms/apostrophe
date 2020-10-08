<template>
  <div class="apos-rich-text-editor">
    <AposContextMenuDialog
      menu-placement="top"
      class-list="apos-context-menu__dialog--unpadded apos-rich-text-editor__dialog"
    >
      <!-- <editor-menu-bar :editor="editor">
        <div class="apos-rich-text-toolbar" slot-scope="{ commands, isActive }">
          <component
            v-for="(item, index) in toolbar"
            :key="item + '-' + index"
            :is="(tools[item] && tools[item].component) || 'ApostropheTiptapUndefined'"
            :name="item"
            :tool="tools[item]"
            :options="options"
            :editor="editor"
          />
        </div>
      </editor-menu-bar> -->
      <editor-menu-bubble
        :editor="editor"
        :keep-in-bounds="true"
        v-slot="{ commands, isActive, menu }"
      >
        <div
          class="apos-rich-text-toolbar apos-theme-dark"
          :style="`
            left: ${menu.left}px;
            bottom: ${menu.bottom}px;
          `"
        >
          <component
            v-for="(item, index) in toolbar"
            :key="item + '-' + index"
            :is="(tools[item] && tools[item].component) || 'ApostropheTiptapUndefined'"
            :name="item"
            :tool="tools[item]"
            :options="options"
            :editor="editor"
          />
        </div>
      </editor-menu-bubble>
    </AposContextMenuDialog>
    <editor-content :editor="editor" />
  </div>
</template>

<script>
import {
  Editor,
  EditorContent,
  EditorMenuBar,
  EditorMenuBubble
} from 'tiptap';

import {
  HardBreak,
  ListItem,
  OrderedList,
  BulletList,
  Bold,
  Italic,
  History,
  Strike,
  Blockquote,
  CodeBlock,
  HorizontalRule
} from 'tiptap-extensions';

// Here because we cannot access computed inside data

function moduleOptionsBody(type) {
  return apos.modules[apos.area.widgetManagers[type]];
}

export default {
  name: 'ApostropheRichTextWidgetEditor',
  components: {
    EditorMenuBar,
    EditorContent,
    EditorMenuBubble
  },
  props: {
    type: {
      type: String,
      required: true
    },
    options: {
      type: Object,
      required: true
    },
    value: {
      type: Object,
      default() {
        return {};
      }
    },
    docId: {
      type: String,
      required: false,
      default() {
        return null;
      }
    }
  },
  emits: [ 'update' ],
  data() {
    return {
      tools: moduleOptionsBody(this.type).tools,
      toolbar: this.options.toolbar,
      editor: new Editor({
        extensions: [
          new BulletList(),
          new HardBreak(),
          new ListItem(),
          new OrderedList(),
          new Bold(),
          new Italic(),
          new History(),
          new Strike(),
          new Blockquote(),
          new CodeBlock(),
          new HorizontalRule()
        ].concat((apos.tiptapExtensions || []).map(C => new C(this.options))),
        autoFocus: true,
        onUpdate: this.update,
        content: this.value.content
      }),
      widgetInfo: {
        data: this.value,
        hasErrors: false
      }
    };
  },
  computed: {
    moduleOptions() {
      return moduleOptionsBody(this.type);
    }
  },
  beforeDestroy() {
    this.editor.destroy();
  },
  methods: {
    async update() {
      const content = this.editor.getHTML();
      const widget = this.widgetInfo.data;
      widget.content = content;
      this.$emit('update', widget);
    },
    command(name, options) {
      this.commands[name](options);
    }
  }
};
</script>

<style lang="scss" scoped>

  .apos-rich-text-toolbar {
    position: absolute;
    display: flex;
    align-items: center;
    background-color: var(--a-background-primary);
    color: var(--a-text-primary);
    border-radius: var(--a-border-radius);
  }

  .apos-rich-text-toolbar /deep/ .apos-active {
    background-color: var(--a-base-8);
  }
</style>
