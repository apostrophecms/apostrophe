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

    };
  },
  computed: {
    active() {
      const styles = this.styles || [];
      for (let i = 0; (i < styles.length); i++) {
        const style = styles[i];
        // const attrs = {
        //   tag: style.tag,
        //   class: style.class || null
        // };
        // if (this.editor.isActive.styles(attrs)) {
        //   return i;
        // }
        // TODO still not passing classes, probably a bad match
        if (this.editor.isActive(style.type, (style.typeParameters || {}))) {
          return i;
        }
      }
      return 0;
    },
    moduleOptions() {
      return window.apos.modules['@apostrophecms/rich-text-widget'];
    },
    elementProperties() {
      return this.moduleOptions.elementProperties;
    },
    styles() {
      const self = this;
      return this.options.styles.map(style => {
        const settings = getSettings(style);
        style = {
          ...style,
          ...settings
        };
        return style;
      });

      function getSettings(style) {
        let settings;
        for (const key in self.elementProperties) {
          if (self.elementProperties[key].tags.includes(style.tag)) {
            settings = { ...self.elementProperties[key].settings };
          }
        }

        // final massaging
        if (settings.type === 'heading') {
          const level = parseInt(style.tag.split('h')[1]);
          settings.typeParameters.level = level;
        }

        // Handle custom classes
        if (style.class) {
          settings.typeParameters.class = style.class;
        }
        return settings;
      }
    }
  },
  methods: {
    setStyle($event) {
      const style = this.styles[$event.target.value];
      this.editor.commands[style.command](style.typeParameters || {});
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
