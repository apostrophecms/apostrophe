<template>
  <div contenteditable="true" @input="update" v-html="initialRichText"></div>
</template>

<script>

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
      initialRichText: this.value.content,
      widgetInfo: {
        data: this.value,
        hasErrors: false,
      }
    }
  },
  methods: {
    update(event) {
      const content = event.target.innerHTML;
      const widget = this.widgetInfo.data;
      widget.content = content;
      this.$emit('input', this.widgetInfo.data);
    }
  }
};
</script>
