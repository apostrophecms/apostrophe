<template>
  <div class="apos-tiptap-select">
    <select
      :value="active"
      @change="setStyle"
      class="apos-tiptap-control apos-tiptap-control--select"
    >
      <option
        v-for="(style, i) in styles"
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
  data() {
    return {
      // styles: null
    };
  },
  computed: {
    active() {
      const styles = this.styles || [];
      for (let i = 0; (i < styles.length); i++) {
        const style = styles[i];
        if (this.editor.isActive(style.type, (style.typeParameters || {}))) {
          return i;
        }
      }
      return 0;
    },
    moduleOptions() {
      return window.apos.modules['@apostrophecms/rich-text-widget'];
    },
    tiptapCommands() {
      return this.moduleOptions.tiptapCommands;
    },
    tiptapTypeMap() {
      return this.moduleOptions.tiptapTypeMap;
    },
    styles() {
      const self = this;
      const styles = [];
      this.options.styles.forEach(style => {
        style.options = {};
        for (const key in self.tiptapCommands) {
          if (self.tiptapCommands[key].includes(style.tag)) {
            style.command = key;
          }
        }
        for (const key in self.tiptapTypeMap) {
          if (self.tiptapTypeMap[key].includes(style.tag)) {
            style.type = key;
          }
        }

        // Set heading level
        if (style.type === 'heading') {
          const level = parseInt(style.tag.split('h')[1]);
          style.options.level = level;
        }

        // Handle custom attributes
        if (style.class) {
          style.options.class = style.class;
        }

        if (style.type) {
          styles.push(style);
        } else {
          apos.notify(`Misconfigured rich text style: label: ${style.label}, tag: ${style.tag}`, {
            type: 'warning',
            dismiss: true,
            icon: 'file-document-icon'
          });
        }
      });

      return styles;
    }
  },
  mounted() {
    // this.styles = this.computeSettings();
  },
  methods: {
    setStyle($event) {
      const style = this.styles[$event.target.value];
      this.editor.commands.focus();
      this.editor.commands[style.command](style.type, style.options || {});
    },
    async computeSettings() {

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

  .apos-tiptap-select /deep/ .apos-tiptap-select__icon {
    position: absolute;
    top: 50%;
    right: 5px;
    transform: translateY(-50%);
    height: 11px;
    pointer-events: none;
  }
</style>
