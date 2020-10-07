<template>
  <!-- <button 
    @click="click"
    class="apos-tiptap-control apos-tiptap-control--button"
    :class="{ 'apos-active': active }"
  > -->
  <!-- </button> -->
  <AposButton
    :label="tool.label"
    :icon-only="true"
    icon="label-icon"
    type="rich-text"
    :modifiers="['no-border']"
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
.apos-active {
  background-color: var(--a-brand-blue);
}
</style>
