<template>
  <div class="apos-link-control">
    <button
      @click="click"
      ref="button"
    >
      {{ tool.label }}
    </button>
    <editor-menu-bubble
      :editor="editor"
      :keep-in-bounds="keepInBounds"
      v-slot="{ commands, isActive, menu }"
    >
      <div
        class="apos-link-control__dialog"
        :class="{
          'is-ready': menu.isActive,
          'is-triggered': active,
          'has-selection': hasSelection
        }"
        :style="
          `left: ${menu.left}px;
          bottom: ${menu.bottom}px;
          transform: translate3d(-25px, calc(100% + ${offset}), 0);
          `"
      >
        <AposContextMenuDialog
          menu-placement="bottom-start"
        >
          <form>
            <AposSchema
              :schema="schema"
              :value="value"
            />
            <AposButton
              type="default" label="Cancel"
              @click="close"
            />
            <AposButton
              type="primary" label="Save"
              @click="save"
            />
          </form>
        </AposContextMenuDialog>
      </div>
    </editor-menu-bubble>
  </div>
</template>

<script>
import klona from 'klona';
import { EditorMenuBubble } from 'tiptap';
import {
  VPopover
} from 'v-tooltip';

export default {
  name: 'ApostropheTiptapLink',
  components: {
    'v-popover': VPopover,
    EditorMenuBubble
  },
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
    }
  },
  data () {
    const field = {
      name: '',
      label: '',
      placeholder: '',
      help: false,
      required: false,
      disabled: false
    };
    const value = {
      data: '',
      error: false
    };

    return {
      keepInBounds: true,
      href: null,
      id: null,
      target: null,
      active: false,
      blankField: field,
      blankValue: value,
      value: {
        data: {
          href: 'cool nice',
          id: 'lweieipwn',
          target: '_self'
        }
      },
      schema: [
        {
          name: 'href',
          label: 'URL',
          placeholder: 'HIII',
          type: 'string'
        },
        {
          name: 'id',
          label: 'Anchor Name',
          placeholder: 'anchor name',
          type: 'string'
        },
        {
          name: 'target',
          label: 'Target',
          placeholder: 'HIII',
          type: 'select',
          choices: [
            {
              label: 'Current browsing context (_self)',
              value: '_self'
            },
            {
              label: 'New tab or window (_blank)',
              value: '_blank'
            },
            {
              label: 'Parent browsing context (_parent)',
              value: '_parent'
            },
            {
              label: 'Topmost browsing context (_top)',
              value: '_top'
            }
          ]
        }
      ]
    };
  },
  computed: {
    hasSelection() {
      return this.editor.selection.from !== this.editor.selection.to;
    },
    offset() {
      const selection = window.getSelection();
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      return (rect.height + 15) + 'px';
    }
  },
  watch: {
    hasSelection(newVal, oldVal) {
      if (!newVal) {
        this.close();
      }
    }
  },
  created() {
    // this.resetFields();
  },
  methods: {
    click() {
      if (this.hasSelection) {
        // this.resetFields();
        this.active = !this.active;
        this.populateFields();
      }
    },
    close() {
      this.active = false;
      this.editor.focus();
    },
    save() {
      this.editor.commands[this.name]({
        href: this.href.value.data,
        id: this.id.value.data,
        target: this.target.value.data
      });
      this.active = false;
    },
    populateFields() {
      console.log('pop called');
      if (this.active) {
        console.log('gonna pop');
        const values = this.editor.getMarkAttrs('link');
        this.value.data.href = values.href;
        this.value.data.id = values.id;
        this.value.data.target = values.target;
      }
    },
    resetFields() {
      this.href = {
        field: {
          ...klona(this.blankField),
          name: 'url',
          label: 'URL',
          help: 'Relative or absolute, the power is yours'
        },
        value: klona(this.blankValue)
      };

      this.id = {
        field: {
          ...klona(this.blankField),
          name: 'id',
          label: 'Anchor Name',
          help: 'This becomes the ID of your selection'
        },
        value: klona(this.blankValue)
      };

      this.target = {
        field: {
          ...klona(this.blankField),
          name: 'target',
          label: 'Target',
          help: 'Where the new link opens up',
          choices: [
            {
              label: 'Current browsing context (_self)',
              value: '_self'
            },
            {
              label: 'New tab or window (_blank)',
              value: '_blank'
            },
            {
              label: 'Parent browsing context (_parent)',
              value: '_parent'
            },
            {
              label: 'Topmost browsing context (_top)',
              value: '_top'
            }
          ]
        },
        value: klona(this.blankValue)
      };
    }
  }
};
</script>

<style lang="scss" scoped>
  .apos-link-control {
    display: inline-block;
  }

  .apos-link-control__dialog {
    z-index: $z-index-modal-bg;
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }

  .apos-link-control__dialog.is-triggered.has-selection.is-ready {
    opacity: 1;
    pointer-events: auto;
  }

</style>
