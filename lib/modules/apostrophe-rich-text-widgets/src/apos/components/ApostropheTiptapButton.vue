<template>
  <button @click="click()">
    {{ options.label }}
  </button>
</template>

<script>

export default {
  name: 'ApostropheTiptapButton',
  props: {
    name: String,
    editor: Object,
    options: Object
  },
  methods: {
    click() {
      this.editor.commands[this.name]();
    }
  }
};
</script>
