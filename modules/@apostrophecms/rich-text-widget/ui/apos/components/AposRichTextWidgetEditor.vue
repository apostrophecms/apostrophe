<template>
  <div>
    <bubble-menu
      class="bubble-menu"
      :tippy-options="{ duration: 100 }"
      :editor="editor"
      v-if="editor"
    >
      <AposContextMenuDialog
        menu-placement="top"
        class-list="apos-rich-text-toolbar"
        :has-tip="false"
        :modifiers="['unpadded']"
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
    </bubble-menu>
    <div class="apos-rich-text-editor__editor" :class="editorModifiers">
      <editor-content :editor="editor" :class="moduleOptions.className" />
    </div>
    <div class="apos-rich-text-editor__editor_after" :class="editorModifiers">
      {{ $t('apostrophe:emptyRichTextWidget') }}
    </div>
  </div>
</template>

<script>
import {
  Editor,
  EditorContent,
  BubbleMenu
} from '@tiptap/vue-2';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import TextStyle from '@tiptap/extension-text-style';
export default {
  name: 'AposRichTextWidgetEditor',
  components: {
    EditorContent,
    BubbleMenu
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
      editor: null,
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
      return apos.modules[apos.area.widgetManagers[this.type]];
    },
    defaultOptions() {
      return this.moduleOptions.defaultOptions;
    },
    editorOptions() {
      const activeOptions = Object.assign({}, this.options);

      // Allow toolbar option to pass through if `false`
      activeOptions.toolbar = (activeOptions.toolbar !== undefined)
        ? activeOptions.toolbar : this.defaultOptions.toolbar;

      activeOptions.styles = this.enhanceStyles(activeOptions.styles || this.defaultOptions.styles);

      return activeOptions;
    },

    initialContent() {
      return this.stripPlaceholderBrs(this.value.content);
    },
    toolbar() {
      return this.editorOptions.toolbar;
    },
    tools() {
      return this.moduleOptions.tools;
    },
    isVisuallyEmpty () {
      const div = document.createElement('div');
      div.innerHTML = this.value.content;
      return !div.textContent;
    },
    editorModifiers () {
      const classes = [];
      if (this.isVisuallyEmpty) {
        classes.push('apos-is-visually-empty');
      }
      return classes;
    },
    tiptapTextCommands() {
      return this.moduleOptions.tiptapTextCommands;
    },
    tiptapTypes() {
      return this.moduleOptions.tiptapTypes;
    },
    aposTiptapExtensions() {
      return (apos.tiptapExtensions || [])
        .map(extension => extension({
          styles: this.editorOptions.styles,
          types: this.tiptapTypes
        }));
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
  mounted() {
    this.editor = new Editor({
      content: this.initialContent,
      autofocus: !this.initialContent,
      onUpdate: this.editorUpdate,
      extensions: [
        StarterKit,
        TextAlign.configure({
          types: [ 'heading', 'paragraph' ]
        }),
        Highlight,
        TextStyle
      ].concat(this.aposTiptapExtensions)
    });
  },

  beforeDestroy() {
    this.editor.destroy();
  },
  methods: {
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
    },
    // Enhances the dev-defined styles list with tiptap
    // commands and parameters used internally.
    enhanceStyles(styles) {
      const self = this;
      (styles || []).forEach(style => {
        style.options = {};
        for (const key in self.tiptapTextCommands) {
          if (self.tiptapTextCommands[key].includes(style.tag)) {
            style.command = key;
          }
        }
        for (const key in self.tiptapTypes) {
          if (self.tiptapTypes[key].includes(style.tag)) {
            style.type = key;
          }
        }

        // Set heading level
        if (style.type === 'heading') {
          const level = parseInt(style.tag.split('h')[1]);
          style.options.level = level;
        }

        // Handle custom attributes
        if (style.class) {
          style.options.class = style.class;
        }

        if (!style.type) {
          apos.notify('apostrophe:richTextStyleConfigWarning', {
            type: 'warning',
            dismiss: true,
            icon: 'text-box-remove-icon',
            interpolate: {
              label: style.label,
              tag: style.tag
            }
          });
        }
      });

      // ensure a default so we can rely on it throughout
      const hasDefault = !!styles.find(style => style.def);
      if (!hasDefault && styles.length) {
        // If no dev set default, use the first paragraph we can find
        if (styles.filter(style => style.type === 'paragraph').length) {
          styles.filter(style => style.type === 'paragraph')[0].def = true;
        } else {
          // Otherwise, set the first style
          styles[0].def = true;
        }
      }
      return styles;
    }
  }
};

</script>

<style lang="scss" scoped>

  .apos-rich-text-toolbar.editor-menu-bubble {
    z-index: $z-index-manager-toolbar;
    position: absolute;
    transform: translate3d(-50%, -50%, 0);
  }

  .apos-rich-text-toolbar.editor-menu-bar {
    display: inline-block;
    margin-bottom: 10px;
  }

  .apos-rich-text-toolbar__inner {
    display: flex;
    align-items: stretch;
    height: 35px;
    background-color: var(--a-background-primary);
    color: var(--a-text-primary);
    border-radius: var(--a-border-radius);
  }

  .apos-rich-text-toolbar ::v-deep .apos-is-active {
    background-color: var(--a-base-9);
  }

  .apos-rich-text-editor__editor ::v-deep .ProseMirror:focus {
    outline: none;
  }

  .apos-rich-text-editor__editor {
    @include apos-transition();
    position: relative;
    border-radius: var(--a-border-radius);
    box-shadow: 0 0 0 1px transparent;
  }
  .apos-rich-text-editor__editor.apos-is-visually-empty {
    box-shadow: 0 0 0 1px var(--a-primary-transparent-50);
  }
  .apos-rich-text-editor__editor_after {
    @include type-small;
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    display: block;
    width: 200px;
    height: 10px;
    margin: auto;
    margin-top: 7.5px;
    margin-bottom: 7.5px;
    color: var(--a-base-5);
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    text-align: center;
    &.apos-is-visually-empty {
      opacity: 1;
      visibility: visible;
    }
  }
  .apos-rich-text-toolbar__inner ::v-deep > .apos-rich-text-editor__control {
    /* Addresses a Safari-only situation where it inherits the
      `::-webkit-scrollbar-button` 2px margin. */
    margin: 0;
  }

</style>
