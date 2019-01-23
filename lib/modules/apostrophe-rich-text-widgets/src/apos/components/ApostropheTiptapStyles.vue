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
      for (let i = 0; (i < this.options.styles.length); i++) {
        const style = this.options.styles[i];
        const attrs = {
          tag: style.tag,
          class: style.class || null
        };
        if (this.editor.isActive.styles(attrs)) {
          console.log(' --> ' + i);
          return i;
        }
      }
      console.log('fallback');
      return 0;
    },
    style($event) {
      const style = this.options.styles[$event.target.value];
      console.log('style is:');
      console.log(style);
      this.editor.commands.styles(style);
    }
  }
};
</script>
