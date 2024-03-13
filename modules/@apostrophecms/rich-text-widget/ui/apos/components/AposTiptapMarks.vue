<template>
  <div class="apos-marks-control">
    <AposButton
      type="rich-text"
      class="apos-marks-control__button"
      :label="buttonLabel"
      :icon="tool.icon"
      :icon-size="16"
      :modifiers="['no-border', 'no-motion']"
      :tooltip="{
        content: tool.label,
        placement: 'top',
        delay: 650
      }"
      @click="click"
    />
    <div
      v-if="open"
      v-click-outside-element="close"
      class="apos-popover apos-marks-control__dialog"
      x-placement="bottom"
    >
      <AposContextMenuDialog
        menu-placement="bottom-start"
        class-list="apos-context-menu__dialog--unpadded"
      >
        <div class="apos-marks-control__content-wrapper">
          <ul class="apos-marks-control__items">
            <li
              v-for="mark in options.marks"
              :key="mark.class"
              class="apos-marks-control__item"
              :class="{ 'apos-marks-control__item--is-active': activeClasses.includes(mark.class) }"
            >
              <button class="apos-marks-control__button" @click="toggleStyle(mark)">
                <span class="apos-marks-control__label" :class="options.marksPreview ? mark.class : null">
                  {{ mark.label }}
                </span>
              </button>
            </li>
          </ul>
        </div>
      </AposContextMenuDialog>
    </div>
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
  data() {
    return {
      active: false,
      open: false
    };
  },
  computed: {
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
      return activeClasses;
    },
    buttonLabel() {
      let label = this.tool.label;
      if (this.activeClasses.length > 1) {
        label = this.$t('apostrophe:richTextMarkMultipleStyles');
      }
      if (this.activeClasses.length === 1) {
        label = this.options.marks.find(m => m.class === this.activeClasses[0])?.label;
      }
      return label;
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
      this.editor.commands.focus();
      this.editor.commands[mark.command](mark.type, mark.options || {});
      this.close();
    },
    click() {
      this.toggleOpen();
    },
    toggleOpen() {
      this.open = !this.open;
    },
    close() {
      this.open = false;
    }
  }
};
</script>

<style lang="scss" scoped>
  .apos-marks-control {
    position: relative;
  }

  .apos-marks-control__button:deep(.apos-button--rich-text) {
    &:active:after, &:focus:after {
      background-color: var(--a-base-8)
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

  .apos-marks-control__dialog {
    position: absolute;
    top: calc(100% + 8px);
    left: 0;
  }

  .apos-marks-control__items {
    display: flex;
    flex-direction: column;
    gap: 3px;
    margin: 0;
    padding: 8px;
    list-style: none;
  }

  .apos-marks-control__item {
    white-space: nowrap;
    font-size: 14px;
    max-width: 230px;
    text-overflow: ellipsis;
    overflow: hidden;
    border-radius: var(--a-border-radius);

    .apos-marks-control__label {
      position: static !important;
      height: auto !important;
      font-size: 14px !important;
      padding: 0 !important;
      margin: 0 !important;
    }

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
      display: block;
      width: 100%;
      padding: 8px;
    }
  }

</style>
