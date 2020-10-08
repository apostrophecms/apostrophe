<template>
  <AposButton
    type="rich-text"
    @click="click"
    class="apos-rich-text-editor__control"
    :class="{ 'apos-active': active }"
    :label="tool.label"
    :icon-only="!!tool.icon"
    :icon="tool.icon ? tool.icon : false"
    :icon-size="16"
    :modifiers="['no-border', 'no-motion']"
  />
</template>

<script>

export default {
  name: 'ApostropheTiptapButton',
  props: {
    name: {
      type: String,
      required: true
    },
    editor: {
      type: Object,
      required: true
    },
    tool: {
      type: Object,
      required: true
    }
  },
  computed: {
    active() {
      const activeTester = this.editor.isActive[this.command()];
      if (!activeTester) {
        return false;
      }
      activeTester.bind(this.editor);
      return activeTester(this.tool.commandParameters);
    }
  },
  methods: {
    command() {
      return this.tool.command || this.name;
    },
    click() {
      this.editor.commands[this.command()](this.tool.commandParameters || {});
    }
  }
};
</script>

<style lang="scss" scoped>
</style>
