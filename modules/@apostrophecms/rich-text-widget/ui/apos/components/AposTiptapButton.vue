<template>
  <AposButton
    type="rich-text"
    @click="click"
    class="apos-rich-text-editor__control"
    :class="{ 'is-active': active }"
    :label="tool.label"
    :icon-only="!!tool.icon"
    :icon="tool.icon ? tool.icon : false"
    :icon-size="16"
    :modifiers="['no-border', 'no-motion']"
  />
</template>

<script>

export default {
  name: 'AposTiptapButton',
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
      return this.editor.isActive(this.name, this.tool.commandParameters || {});
    }
  },
  methods: {
    command() {
      return this.tool.command || this.name;
    },
    click() {
      this.editor.commands[this.command()](this.tool.commandParameters || {});
      this.editor.chain().focus();
    }
  }
};
</script>

<style lang="scss" scoped>
</style>
