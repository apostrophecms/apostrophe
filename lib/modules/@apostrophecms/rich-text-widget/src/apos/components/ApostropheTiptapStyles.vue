<template>
  <select :value="active()" @change="style">
    <option v-for="style, i in options.styles" :value="i">{{ style.label }}</option>
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
  methods: {
    active() {
      const styles = this.options.styles || [];
      for (let i = 0; (i < styles.length); i++) {
        const style = styles[i];
        const attrs = {
          tag: style.tag,
          class: style.class || null
        };
        if (this.editor.isActive.styles(attrs)) {
          return i;
        }
      }
      return 0;
    },
    style($event) {
      const style = this.options.styles[$event.target.value];

      this.editor.commands.styles(style);
    }
  }
};
</script>
