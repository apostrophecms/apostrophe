<template>
  <select v-model="style">
    <option v-for="style in options.styles" :value="style">{{ style.label }}</option>
  </select>
</template>

<script>

export default {
  name: 'ApostropheTiptapStyles',
  props: {
    name: String,
    editor: Object,
    tool: Object,
    options: Object
  },
  data() {
    return {
      style: this.options.styles[0]
    }
  },
  watch: {
    style() {
      this.editor.commands.styles(this.style);
    }
  }
};
</script>
