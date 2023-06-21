<template>
  <div class="apos-tiptap-select">
    <format-text-icon
      :size="16"
      class="apos-tiptap-select__type-icon"
      fill-color="currentColor"
    />
    <select
      v-apos-tooltip="{
        content: 'apostrophe:richTextStyles',
        placement: 'top',
        delay: 650
      }"
      :value="active"
      @change="setStyle"
      class="apos-tiptap-control apos-tiptap-control--select"
      :style="`width:${options.styles[active].label.length * 6.5}px`"
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
    @include apos-transition();
    height: 100%;
    padding: 0 10px;
    font-size: var(--a-type-smaller);

    &:focus, &:active {
      outline: none;
    }
  }

  .apos-tiptap-select {
    position: relative;
    display: flex;
    align-items: center;
    padding: 0 4px;
    color: var(--a-base-1);
    border-radius: var(--a-border-radius);
    transition: all 0.5s ease;
    &:hover {
      color: var(--a-text-primary);
      background-color: var(--a-base-9);
    }
  }

  .apos-tiptap-select__type-icon {
    padding-top: 2px;
  }

</style>
