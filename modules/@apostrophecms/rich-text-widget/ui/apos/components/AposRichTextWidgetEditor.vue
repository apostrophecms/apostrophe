<template>
  <div class="apos-rich-text-editor">
    <component
      :is="menuType"
      :editor="editor"
      :keep-in-bounds="false"
      v-slot="{ menu, focused }"
    >
      <AposContextMenuDialog
        menu-placement="top"
        class-list="apos-rich-text-toolbar"
        :modifiers="['unpadded']"
        :class="extraClasses(menu, focused)"
        :style="`left: ${menu ? menu.left : 0}px; bottom: ${menu ? menu.bottom : 0}px;`"
      >
        <div class="apos-rich-text-toolbar__inner">
          <component
            v-for="(item, index) in toolbar"
            :key="item + '-' + index"
            :is="(tools[item] && tools[item].component) || 'AposTiptapUndefined'"
            :name="item"
            :tool="tools[item]"
            :options="options"
            :editor="editor"
          />
        </div>
      </AposContextMenuDialog>
    </component>
    <div class="apos-rich-text-editor__editor">
      <editor-content :editor="editor" :class="moduleOptions.className" />
    </div>
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
  name: 'AposRichTextWidgetEditor',
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
      docFields: {
        data: {
          ...this.value
        },
        hasErrors: false
      }
    };
  },
  computed: {
    moduleOptions() {
      return moduleOptionsBody(this.type);
    },
    menuType() {
      if (this.options.menuType && this.options.menuType === 'block') {
        return 'editor-menu-bar';
      }
      return 'editor-menu-bubble';
    }
  },
  beforeDestroy() {
    this.editor.destroy();
  },
  methods: {
    extraClasses(menu, focused) {
      const classes = [];

      classes.push(this.menuType);

      if (menu && menu.isActive) {
        classes.push('is-active');
      }

      if (focused && !menu) {
        classes.push('is-active');
      }

      return classes.join(' ');
    },
    async update() {
      const content = this.editor.getHTML();
      const widget = this.docFields.data;
      widget.content = content;
      // ... removes need for deep watching in parent
      this.$emit('update', { ...widget });
    },
    command(name, options) {
      this.commands[name](options);
    }
  }
};
</script>

<style lang="scss" scoped>

  .apos-rich-text-toolbar {
    opacity: 0;
    pointer-events: none;
  }

  .apos-rich-text-toolbar.editor-menu-bubble {
    z-index: $z-index-manager-toolbar;
    position: absolute;
    transform: translate3d(-50%, -50%, 0);
  }

  .apos-rich-text-toolbar.editor-menu-bar {
    display: inline-block;
    margin-bottom: 10px;
  }

  .apos-rich-text-toolbar /deep/ .apos-context-menu__tip {
    display: none;
  }

  .apos-rich-text-toolbar.is-active {
    opacity: 1;
    pointer-events: auto;
  }

  .apos-rich-text-toolbar__inner {
    display: flex;
    align-items: center;
    background-color: var(--a-background-primary);
    color: var(--a-text-primary);
    border-radius: var(--a-border-radius);
  }

  .apos-rich-text-toolbar /deep/ .is-active {
    background-color: var(--a-base-9);
  }

  .apos-rich-text-editor__editor /deep/ .ProseMirror:focus {
    outline: none;
  }

</style>
