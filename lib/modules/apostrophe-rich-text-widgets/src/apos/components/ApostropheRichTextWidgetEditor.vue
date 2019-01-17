<template>
  <vddl-nodrag class="nodrag">
    <div class="apos-richtext-editor">
      <editor-menu-bar :editor="editor">
        <div class="apos-richtext-menubar" slot-scope="{ commands, isActive }">
          <component v-for="item in toolbar"
            :is="item === '|' ? 'span' : `${item}Button`"
            :commands="commands"
            :isActive="isActive">
          </component>
        </div>
      </editor-menu-bar>
      <editor-content :editor="editor" />
    </div>
  </vddl-nodrag>
</template>

<script>
import BoldButton from './buttons/Bold';
import HeadingButton from './buttons/Heading';
import ItalicButton from './buttons/Italic';
import LinkButton from './buttons/Link';
import OrderedListButton from './buttons/OrderedList';
import RedoButton from './buttons/Redo';
import UndoButton from './buttons/Undo';
import UnorderedListButton from './buttons/UnorderedList';

import { Editor, EditorContent, EditorMenuBar } from 'tiptap';
import {
  HardBreak,
  Heading,
  ListItem,
  OrderedList,
  BulletList,
  Bold,
  Italic,
  Link,
  History,
} from 'tiptap-extensions';

export default {
  name: 'ApostropheRichTextWidgetEditor',
  components: {
    EditorMenuBar,
    EditorContent,
    BoldButton,
    HeadingButton,
    ItalicButton,
    LinkButton,
    OrderedListButton,
    RedoButton,
    UndoButton,
    UnorderedListButton
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
      toolbar: this.options.toolbar,
      heading: this.options.heading,
      editor: new Editor({
        extensions: [
          new BulletList(),
          new HardBreak(),
          new Heading({ levels: [1, 2, 3] }),
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
      console.log(content);
      this.$emit('input', this.widgetInfo.data);
    }
  }
};
</script>
