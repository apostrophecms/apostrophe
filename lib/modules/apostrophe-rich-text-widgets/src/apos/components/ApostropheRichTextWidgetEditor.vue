<template>
  <ckeditor :editor="editor" v-model="editorData" @input="update"></ckeditor>
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
