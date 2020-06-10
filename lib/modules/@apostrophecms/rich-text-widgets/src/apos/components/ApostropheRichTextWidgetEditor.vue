<template>
  <div class="apos-richtext-editor">
    <editor-menu-bar :editor="editor">
      <div class="apos-richtext-menubar" slot-scope="{ commands, isActive }">
        <component v-for="item in toolbar"
          v-bind:key="item"
          :is="(tools[item] && tools[item].component) || 'ApostropheTiptapUndefined'"
          :name="item"
          :tool="tools[item]"
          :options="options"
          :editor="editor"
        />
      </div>
    </editor-menu-bar>
    <editor-content :editor="editor" />
  </div>
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
  Strike,
  Blockquote,
  CodeBlock,
  HorizontalRule
} from 'tiptap-extensions';

// Here because we cannot access computed inside data

function moduleOptionsBody(type) {
  return apos.modules[apos.areas.widgetManagers[type]];  
}

export default {
  name: 'ApostropheRichTextWidgetEditor',
  components: {
    EditorMenuBar,
    EditorContent
  },
  props: {
    type: String,
    options: Object,
    value: Object,
    _docId: String,
    _id: String
  },
  computed: {
    moduleOptions() {
      return moduleOptionsBody(this.type);
    }
  },
  data() {
    const data = {
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
        hasErrors: false,
      }
    }
    return data;
  },
  beforeDestroy() {
    this.editor.destroy()
  },
  methods: {
    async update() {
      const content = this.editor.getHTML();
      const widget = this.widgetInfo.data;
      widget.content = content;

      await apos.http.patch(`${apos.docs.action}/${this._docId}`, {
        body: {
          [`@${this._id}`]: this.widgetInfo.data
        }
      });
    },
    command(name, options) {
      this.commands[name](options);
    }
  }
};
</script>

<style type="text/css">
  .apos-richtext-menubar {
    margin: 12px 0;
  }
</style>