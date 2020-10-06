<template>
  <div class="apos-link-control">
    <button
      @click="click"
      ref="button"
      :class="{ 'apos-active': buttonActive }"
    >
      {{ tool.label }}
    </button>
    <editor-menu-bubble
      :editor="editor"
      :keep-in-bounds="keepInBounds"
      v-slot="{ menu }"
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
          v-if="active"
        >
          <form>
            <AposSchema
              :schema="schema"
              v-model="value"
            />
            <footer class="apos-link-control__footer">
              <AposButton
                type="default" label="Cancel"
                @click="close"
              />
              <AposButton
                type="primary" label="Save"
                @click="save"
              />
            </footer>
          </form>
        </AposContextMenuDialog>
      </div>
    </editor-menu-bubble>
  </div>
</template>

<script>

import { EditorMenuBubble } from 'tiptap';
import { isEmpty } from 'lodash';
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
    return {
      keepInBounds: true,
      href: null,
      id: null,
      target: null,
      active: false,
      value: {
        data: {}
      },
      schema: [
        {
          name: 'href',
          label: 'URL',
          help: 'Where should the link go?',
          placeholder: 'http://calm.com',
          type: 'string'
        },
        {
          name: 'id',
          label: 'Anchor Name',
          help: 'This becomes the ID of the anchor',
          type: 'string'
        },
        {
          name: 'target',
          label: 'Target',
          help: 'Where should this link open?',
          type: 'select',
          def: '_self',
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
    buttonActive() {
      return !isEmpty(this.value.data);
    },
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
    'editor.selection.from': {
      handler(newVal, oldVal) {
        this.populateFields();
      }
    },
    hasSelection(newVal, oldVal) {
      if (!newVal) {
        this.close();
      }
    }
  },
  methods: {
    click() {
      if (this.hasSelection) {
        this.active = !this.active;
        this.populateFields();
      }
    },
    close() {
      this.active = false;
      this.editor.focus();
    },
    save() {
      this.editor.commands[this.name](this.value.data);
      this.active = false;
    },
    populateFields() {
      const attrs = this.editor.getMarkAttrs('link');
      this.value.data = {};
      this.schema.forEach((item) => {
        if (attrs[item.name]) {
          this.value.data[item.name] = attrs[item.name];
        }
      });
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

  .apos-active {
    background-color: var(--a-brand-blue);
  }

  .apos-link-control__footer {
    display: flex;
    justify-content: flex-end;
    margin-top: 10px;
  }

  .apos-link-control__footer .apos-button {
    margin-left: 7.5px;
  }
</style>
