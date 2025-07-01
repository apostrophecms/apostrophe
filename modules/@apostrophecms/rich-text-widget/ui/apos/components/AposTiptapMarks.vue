<template>
  <div class="apos-marks-control">
    <AposContextMenu
      ref="contextMenu"
      menu-placement="bottom-start"
      :button="button"
      :rich-text-menu="true"
      :center-on-icon="true"
      @open="openPopover"
      @close="closePopover"
    >
      <div class="apos-popover apos-marks-control__dialog">
        <div class="apos-marks-control__content-wrapper">
          <ul class="apos-marks-control__items">
            <li
              v-for="mark in options.marks"
              :key="mark.class"
              class="apos-marks-control__item"
              :class="{
                'apos-marks-control__item--is-active': activeClasses.includes(mark.class)
              }"
            >
              <button
                class="apos-marks-control__button"
                @click="toggleStyle(mark)"
              >
                <span
                  class="apos-marks-control__label"
                  :class="mark.class"
                >
                  {{ $t(mark.label) }}
                </span>
              </button>
            </li>
          </ul>
        </div>
      </div>
    </AposContextMenu>
  </div>
</template>

<script>
import AposEditorMixin from 'Modules/@apostrophecms/modal/mixins/AposEditorMixin';

export default {
  name: 'AposTiptapMarks',
  mixins: [ AposEditorMixin ],
  props: {
    name: {
      type: String,
      required: true
    },
    tool: {
      type: Object,
      required: true
    },
    editor: {
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
  emits: [ 'open-popover', 'close' ],
  data() {
    return {
      classes: this.options.marks.map(m => m.class)
    };
  },
  computed: {
    button() {
      return {
        type: 'rich-text',
        label: this.buttonLabel,
        icon: this.tool.icon || false,
        'icon-size': this.tool.iconSize || 16,
        modifiers: [ 'no-border', 'no-motion' ],
        tooltip: {
          content: this.tool.label,
          placement: 'top',
          delay: 650
        }
      };
    },
    activeClasses() {
      let activeClasses = [];
      const { selection } = this.editor.state;
      const content = selection.content();

      traverseContent(content.content);

      function traverseContent(content) {
        content.forEach(item => {
          if (item.attrs.class) {
            activeClasses = activeClasses.concat(item.attrs.class.split(' '));
          }
          if (item?.marks?.length) {
            traverseContent(item.marks);
          }
          if (item?.content?.content) {
            traverseContent(item.content.content);
          }
        });
      }
      // Filter out classes that are not in the list of available classes
      return activeClasses.filter(value => this.classes.includes(value));
    },
    buttonLabel() {
      let label;
      if (this.activeClasses.length > 1) {
        label = this.$t('apostrophe:richTextMarkMultipleStyles');
      }
      if (this.activeClasses.length === 1) {
        label = this.options.marks.find(m => m.class === this.activeClasses[0])?.label;
      }
      return label || this.$t('apostrophe:richTextMarkApplyStyles');
    },
    hasSelection() {
      const { state } = this.editor;
      const { selection } = this.editor.state;
      const { from, to } = selection;
      const text = state.doc.textBetween(from, to, '');
      return text !== '';
    }
  },
  watch: {
    hasSelection(newVal) {
      if (!newVal) {
        this.close();
      }
    }
  },
  methods: {
    toggleStyle(mark) {
      this.editor.commands[mark.command](mark.type, mark.options || {});
      this.editor.chain().focus().blur().run();
      this.close();
    },
    click() {
      this.toggleOpen();
    },
    close() {
      this.$refs.contextMenu.hide();
    },
    openPopover() {
      this.$emit('open-popover');
    },
    closePopover() {
      this.$emit('close');
    }
  }
};
</script>

<style lang="scss" scoped>
  .apos-marks-control {
    position: relative;

    &:deep(.apos-context-menu__pane) {
      padding: 0;
    }
  }

  .apos-marks-control__button:deep(.apos-button--rich-text) {
    &:active::after, &:focus::after {
      background-color: var(--a-base-8);
    }

    .apos-button__label {
      max-width: 200px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  .apos-marks-control__content-wrapper {
    max-height: 200px;
    overflow-y: scroll;
  }

  .apos-marks-control__items {
    display: flex;
    flex-direction: column;
    gap: 3px;
    margin: 0;
    padding: $spacing-base;
    list-style: none;
  }

  .apos-marks-control__item {
    white-space: nowrap;
    max-width: 230px;
    text-overflow: ellipsis;
    overflow: hidden;
    border-radius: var(--a-border-radius);

    // We are adding dev-defined styles into the Apostrophe admin UI,
    // attempt clamp down the dimensions of the label to prevent broken UI
    // stylelint-disable declaration-no-important
    .apos-marks-control__label {
      position: static !important;
      height: auto !important;
      margin: 0 !important;
      padding: 0 !important;
      font-size: var(--a-type-large) !important;
    }
    // stylelint-enable declaration-no-important

    &:hover {
      background-color: var(--a-base-10);
      cursor: pointer;
    }

    &--is-active {
      background-color: var(--a-base-10);

      &:hover {
        background-color: var(--a-base-9);
      }
    }

    .apos-marks-control__button {
      @include apos-button-reset();

      & {
        display: block;
        box-sizing: border-box;
        width: 100%;
        padding: $spacing-base;
      }
    }
  }

</style>
