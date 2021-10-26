<template>
  <div class="apos-tiptap-select">
    <select
      :value="active"
      @change="setStyle"
      class="apos-tiptap-control apos-tiptap-control--select"
    >
      <option
        v-for="(style, i) in options.styles"
        :value="i"
        :key="style.label"
      >
        {{ style.label }}
      </option>
    </select>
    <chevron-down-icon
      :size="11"
      class="apos-tiptap-select__icon"
      fill-color="currentColor"
    />
  </div>
</template>

<script>

export default {
  name: 'AposTiptapStyles',
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
        if (this.editor.isActive(style.type, (style.options || {}))) {
          return i;
        } else if (this.editor.state.selection.$head.parent.type.name === 'defaultNode' && style.def) {
          // Look deeper to see if custom defaultNode is active
          return i;
        }
      }
      return 0;
    },
    moduleOptions() {
      return window.apos.modules['@apostrophecms/rich-text-widget'];
    }
  },
  methods: {
    setStyle($event) {
      const style = this.options.styles[$event.target.value];
      this.editor.commands.focus();
      this.editor.commands[style.command](style.type, style.options || {});
    }
  }
};
</script>

<style lang="scss" scoped>
  // If another select el is needed for the rich-text toolbar these styles should be made global
  .apos-tiptap-control--select {
    @include apos-button-reset();
    @include type-small;
    height: 100%;
    padding: 0 15px 0 10px;

    &:focus, &:active {
      background-color: var(--a-base-9);
      outline: none;
    }
    &:hover {
      background-color: var(--a-base-8);
    }
  }

  .apos-tiptap-select {
    position: relative;
  }

  .apos-tiptap-select ::v-deep .apos-tiptap-select__icon {
    position: absolute;
    top: 50%;
    right: 5px;
    transform: translateY(-50%);
    height: 11px;
    pointer-events: none;
  }
</style>
