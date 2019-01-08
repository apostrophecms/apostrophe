<template>
  <vddl-nodrag class="nodrag">
    <ckeditor :editor="editor" v-model="editorData" @input="update" :config="options"></ckeditor>
  </vddl-nodrag>
</template>

<script>
import CKEditor from '@ckeditor/ckeditor5-vue';
import InlineEditor from '@ckeditor/ckeditor5-build-inline';
import Vue from 'apostrophe/vue';

Vue.use(CKEditor);

export default {
  name: 'ApostropheRichTextWidgetEditor',
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
    // Print names of the available toolbar items, yes this
    // is the official way :eyeroll:
    // InlineEditor.create(document.querySelector('.apos-admin-bar')).then(function(editor) {
    //   console.log(Array.from(editor.ui.componentFactory.names()));
    // });
    return {
      editor: InlineEditor,
      editorData: this.value.content,
      widgetInfo: {
        data: this.value,
        hasErrors: false,
      }
    }
  },
  methods: {
    update() {
      const content = this.editorData;
      const widget = this.widgetInfo.data;
      widget.content = content;
      this.$emit('input', this.widgetInfo.data);
    }
  }
};
</script>
