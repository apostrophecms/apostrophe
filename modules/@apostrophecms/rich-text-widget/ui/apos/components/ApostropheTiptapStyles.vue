<template>
  <select
    :value="active"
    @change="setStyle"
    class="apos-tiptap-control apos-tiptap-control--select"
  >
    <option
      v-for="(style, i) in options.styles"
      :value="i"
      :key="style.label + '-' + i"
    >
      {{ style.label }}
    </option>
  </select>
</template>

<script>

export default {
  name: 'ApostropheTiptapStyles',
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
    },
    options: {
      type: Object,
      default() {
        return {};
      }
    }
  },
  computed: {
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
    }
  },
  methods: {
    setStyle($event) {
      const style = this.options.styles[$event.target.value];
      this.editor.commands.styles(style);
    }
  }
};
</script>
