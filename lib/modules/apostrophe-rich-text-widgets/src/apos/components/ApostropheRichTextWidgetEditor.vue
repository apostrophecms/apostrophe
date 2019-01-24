<template>
  <vddl-nodrag class="nodrag">
    <div class="apos-richtext-editor">
      <editor-menu-bar :editor="editor">
        <div class="apos-richtext-menubar" slot-scope="{ commands, isActive }">
          <component v-for="item in toolbar"
            :is="tools[item].component"
            :name="item"
            :tool="tools[item]"
            :options="options"
            :editor="editor"
          />
        </div>
      </editor-menu-bar>
      <editor-content :editor="editor" />
    </div>
  </vddl-nodrag>
</template>

<script>
import { Editor, EditorContent, EditorMenuBar } from 'tiptap';
import {
  HardBreak,
  ListItem,
  OrderedList,
  BulletList,
  Bold,
  Italic,
  History,
} from 'tiptap-extensions';

import Link from '../tiptap-commands/Link.js';
import Styles from '../tiptap-commands/Styles.js';

export default {
  name: 'ApostropheRichTextWidgetEditor',
  components: {
    EditorMenuBar,
    EditorContent
  },
  props: {
    type: String,
    options: Object,
    value: Object
  },
  computed: {
    moduleOptions() {
      return apos.modules[apos.areas.widgetManagers[this.type]];
    }
  },
  data() {
    return {
      tools: {
        'styles': {
          component: 'ApostropheTiptapStyles',
          label: 'Styles'
        },
        '|': {
          component: 'span',
          label: '|'
        },
        'bold': {
          component: 'ApostropheTiptapButton',
          label: 'Bold'
        },
        'italic': {
          component: 'ApostropheTiptapButton',
          label: 'Italic'
        },
        'link': {
          component: 'ApostropheTiptapLink',
          label: 'Link'
        },
        'bullet_list': {
          component: 'ApostropheTiptapButton',
          label: 'Bullets'
        },
        'ordered_list': {
          component: 'ApostropheTiptapButton',
          label: 'Ordered'
        },
        'undo': {
          component: 'ApostropheTiptapButton',
          label: 'Undo'
        },
        'redo': {
          component: 'ApostropheTiptapButton',
          label: 'Redo'
        }
      },
      toolbar: this.options.toolbar,
      editor: new Editor({
        extensions: [
          new BulletList(),
          new HardBreak(),
          new Styles({ styles: this.options.styles }),
          new ListItem(),
          new OrderedList(),
          new Bold(),
          new Italic(),
          new Link(),
          new History(),
        ],
        autoFocus: true,
        onUpdate: this.update,
        content: this.value.content
      }),
      widgetInfo: {
        data: this.value,
        hasErrors: false,
      }
    }
  },
  beforeDestroy() {
    this.editor.destroy()
  },
  methods: {
    update() {
      const content = this.editor.getHTML();
      const widget = this.widgetInfo.data;
      widget.content = content;

      this.$emit('input', this.widgetInfo.data);
    },
    command(name, options) {
      this.commands[name](options);
    }
  }
};
</script>
