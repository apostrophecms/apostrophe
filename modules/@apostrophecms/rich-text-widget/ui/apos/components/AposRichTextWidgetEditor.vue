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
        :has-tip="false"
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
            :options="editorOptions"
            :editor="editor"
          />
        </div>
      </AposContextMenuDialog>
    </component>
    <div class="apos-rich-text-editor__editor" :class="editorModifiers">
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
    const defaultOptions = moduleOptionsBody(this.type).defaultOptions;
    const toolbar = this.options.toolbar === false ? []
      : (this.options.toolbar || defaultOptions.toolbar);
    let initial = this.stripPlaceholderBrs(this.value.content);
    if (!initial.trim().length) {
      const defaultStyle = (this.options.styles && this.options.styles[0]) || {
        tag: 'p'
      };
      const defaultClass = defaultStyle.class ? ` class="${defaultStyle.class}"` : '';
      initial = `<${defaultStyle.tag}${defaultClass}></${defaultStyle.tag}>`;
    }
    return {
      tools: moduleOptionsBody(this.type).tools,
      toolbar,
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
        ].concat((apos.tiptapExtensions || []).map(C => new C(computeEditorOptions(this.type, this.options)))),
        autoFocus: true,
        onUpdate: this.editorUpdate,
        content: initial
      }),
      docFields: {
        data: {
          ...this.value
        },
        hasErrors: false
      },
      pending: null
    };
  },
  computed: {
    moduleOptions() {
      return moduleOptionsBody(this.type);
    },
    editorOptions() {
      return computeEditorOptions(this.type, this.options);
    },
    menuType() {
      if (this.options.menuType && this.options.menuType === 'block') {
        return 'editor-menu-bar';
      }
      return 'editor-menu-bubble';
    },
    isVisuallyEmpty () {
      const div = document.createElement('div');
      div.innerHTML = this.value.content;
      return !div.textContent;
    },
    editorModifiers () {
      const classes = [];
      if (this.isVisuallyEmpty) {
        classes.push('is-visually-empty');
      }
      return classes;
    }
  },
  watch: {
    focused(newVal) {
      if (!newVal) {
        if (this.pending) {
          this.emitWidgetUpdate();
        }
      }
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
    async editorUpdate() {
      // Hint that we are typing, even though we're going to
      // debounce the actual updates for performance
      if (this.docId === window.apos.adminBar.contextId) {
        apos.bus.$emit('context-editing');
      }
      // Debounce updates. We have our own plumbing for
      // this so that we can change our minds to update
      // right away if we lose focus.
      if (this.pending) {
        // Don't reset the timeout; we still want to save at
        // least once per second if the user is actively typing
        return;
      }
      this.pending = setTimeout(() => {
        this.emitWidgetUpdate();
      }, 1000);
    },
    emitWidgetUpdate() {
      if (this.pending) {
        clearTimeout(this.pending);
        this.pending = null;
      }
      let content = this.editor.getHTML();
      content = this.restorePlaceholderBrs(content);
      const widget = this.docFields.data;
      widget.content = content;
      // ... removes need for deep watching in parent
      this.$emit('update', { ...widget });
    },
    command(name, options) {
      this.commands[name](options);
    },
    // Restore placeholder BRs for empty paragraphs. ProseMirror adds these
    // temporarily so the editing experience doesn't break due to contenteditable
    // issues with empty paragraphs, but strips them on save; however
    // seeing them while editing creates a WYSIWYG expectation
    // on the user's part, so we must maintain them
    restorePlaceholderBrs(html) {
      return html.replace(/<(p[^>]*)>(\s*)<\/p>/gi, '<$1><br /></p>');
    },
    // Strip the placeholder BRs again when populating the editor.
    // Otherwise they get doubled by ProseMirror
    stripPlaceholderBrs(html) {
      return html.replace(/<(p[^>]*)>\s*<br \/>\s*<\/p>/gi, '<$1></p>');
    }
  }
};

function computeEditorOptions(type, explicitOptions) {
  const defaultOptions = moduleOptionsBody(type).defaultOptions;

  const activeOptions = Object.assign({}, explicitOptions);

  // Allow toolbar option to pass through if `false`
  activeOptions.toolbar = (activeOptions.toolbar !== undefined)
    ? activeOptions.toolbar : defaultOptions.toolbar;

  activeOptions.styles = activeOptions.styles || defaultOptions.styles;

  return activeOptions;
}
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

  .apos-rich-text-toolbar.is-active {
    opacity: 1;
    pointer-events: auto;
  }

  .apos-rich-text-toolbar__inner {
    display: flex;
    align-items: stretch;
    height: 35px;
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

  .apos-rich-text-editor__editor {
    @include apos-transition();
    position: relative;
    border-radius: var(--a-border-radius);
    box-shadow: 0 0 0 1px transparent;
    &:after {
      @include type-small;
      content: 'Empty Rich Text Widget';
      position: absolute;
      top: 0;
      right: 0;
      bottom: 0;
      left: 0;
      display: block;
      width: 200px;
      height: 10px;
      margin: auto;
      color: var(--a-base-5);
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      text-align: center;
    }
  }
  .apos-rich-text-editor__editor.is-visually-empty {
    box-shadow: 0 0 0 1px var(--a-primary-50);
    &:after {
      opacity: 1;
      visibility: visible;
    }
  }

  .apos-rich-text-toolbar__inner /deep/ > .apos-rich-text-editor__control {
    /* Addresses a Safari-only situation where it inherits the
      `::-webkit-scrollbar-button` 2px margin. */
    margin: 0;
  }

</style>
