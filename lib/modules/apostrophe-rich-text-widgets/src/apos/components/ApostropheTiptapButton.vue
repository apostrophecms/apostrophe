<template>
  <button @click="click()" :class="{ 'apos-active': active() }">
    {{ tool.label }}
  </button>
</template>

<script>

export default {
  name: 'ApostropheTiptapButton',
  props: {
    name: String,
    editor: Object,
    tool: Object
  },
  methods: {
    command() {
      return this.tool.command || this.name;
    },
    click() {
      this.editor.commands[this.command()](this.tool.commandParameters || {});
    },
    active() {
      let activeTester = this.editor.isActive[this.command()];
      if (!activeTester) {
        return false;
      }
      activeTester.bind(this.editor);
      return activeTester(this.tool.commandParameters);
    }
  }
};
</script>

<style>
  .apos-active {
    background-color: blue;
  }
</style>
