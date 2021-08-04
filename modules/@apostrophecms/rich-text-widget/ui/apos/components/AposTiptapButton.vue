<template>
  <AposButton
    type="rich-text"
    @click="click"
    class="apos-rich-text-editor__control"
    :class="{ 'apos-is-active': active }"
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
      // The parameters passed to isActive are unpredictable.
      // If they do not follow the pattern isActive(NAME, OPTIONS)
      // they should include their own helper
      if (this.tool.isActive) {
        return this.editor.isActive(this.tool.isActive);
      } else {
        return this.editor.isActive(this.name, this.tool.commandParameters || {});
      }
    }
  },
  methods: {
    command() {
      return this.tool.command || this.name;
    },
    click() {
      this.editor.commands[this.command()](this.tool.commandParameters || {});
      this.editor.commands.focus();
    }
  }
};
</script>

<style lang="scss" scoped>
</style>
