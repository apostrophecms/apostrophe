<template>
  <div class="apos-tiptap-select">
    <component
      :is="tool.icon"
      :size="16"
      class="apos-tiptap-select__type-icon"
      fill-color="currentColor"
    />
    <select
      v-apos-tooltip="{
        content: $t(tool.label),
        placement: 'top',
        delay: 650
      }"
      :aria-label="$t(tool.label)"
      :value="active"
      class="apos-tiptap-control apos-tiptap-control--select"
      :style="`width:${$t(nodeOptions[active].label).length * 6.5}px`"
      @change="setStyle"
    >
      <option
        v-for="(style, i) in nodeOptions"
        :key="style.label"
        :value="i"
        :hidden="style.attr === 'hidden'"
      >
        {{ $t(style.label) }}
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
  emits: [ 'close' ],
  data() {
    return {
      multipleSelected: false
    };
  },
  computed: {
    nodeOptions() {
      return [ {
        label: 'apostrophe:richTextNodeMultipleStyles',
        attr: this.multipleSelected ? '' : 'hidden'
      },
      ...this.options.nodes ];
    },
    active() {
      const { selection } = this.editor.state;
      const content = selection.content();
      let activeEls = [];
      const nodes = this.options.nodes.map(n => {
        return {
          type: n.type,
          class: n.options.class || null,
          level: n.options.level || null
        };
      });

      if (content?.content?.content?.length) {
        activeEls = content.content.content.map(n => {
          return {
            name: n.type.name,
            class: n.attrs.class || null,
            level: n.attrs.level || null
          };
        });
      }

      // Remove duplicates
      activeEls = activeEls.filter((item, index, self) => {
        // Find the index of the first occurrence of the current item
        const firstIndex = self.findIndex(t =>
          t.name === item.name &&
          t.class === item.class &&
          t.level === item.level
        );
        // If the index of the current item is the same as the first index,
        // keep it
        return index === firstIndex;
      });

      if (activeEls.length) {
        if (activeEls.length > 1) {
          // More than one node, show 'multiple styles' label
          return 0;
        } else {
          // Only one node, show the style label
          // the default style will look different, detect it specifically
          if (activeEls[0].name === 'defaultNode') {
            return 1;
          } else {
            const match = nodes.findIndex(node =>
              node.class === activeEls[0].class &&
              node.type === activeEls[0].name &&
              node.level === activeEls[0].level
            );
            return match + 1;
          }
        }
      } else {
        // No nodes, show the default label
        return 1;
      }
    },
    moduleOptions() {
      return window.apos.modules['@apostrophecms/rich-text-widget'];
    }
  },
  watch: {
    active(newValue) {
      if (newValue === 0) {
        this.multipleSelected = true;
      } else {
        this.multipleSelected = false;
      }
    }
  },
  methods: {
    setStyle($event) {
      const style = this.nodeOptions[$event.target.value];
      this.editor.commands[style.command](style.type, style.options || {});
      this.editor.chain().focus().blur().run();
      this.$emit('close');
    }
  }
};
</script>

<style lang="scss" scoped>
  // If another select el is needed for the rich-text toolbar
  // these styles should be made global
  .apos-tiptap-control--select {
    @include apos-button-reset();
    @include apos-transition();

    & {
      height: 100%;
      padding: 0 $spacing-half;
      font-size: var(--a-type-smaller);
    }

    &:focus, &:active {
      outline: none;
    }
  }

  .apos-tiptap-select {
    position: relative;
    display: flex;
    align-items: center;
    padding: 0 $spacing-half;
    color: var(--a-base-1);
    border-radius: var(--a-border-radius);
    transition: all 500ms ease;

    &:focus-within,
    &:hover {
      color: var(--a-text-primary);
      background-color: var(--a-base-9);
    }
  }

  .apos-tiptap-select__icon {
    position: absolute;
    right: 0;
  }

  .apos-tiptap-select__type-icon {
    padding-top: 2px;
  }

</style>
