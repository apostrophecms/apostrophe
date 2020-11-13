<template>
  <div class="apos-link-control">
    <AposButton
      type="rich-text"
      @click="click"
      :class="{ 'apos-active': buttonActive }"
      :label="tool.label"
      :icon-only="!!tool.icon"
      :icon="tool.icon ? tool.icon : false"
      :modifiers="['no-border', 'no-motion']"
    />
    <!--
      TODO: Confirm if the `editor` object passed into this `editor-menu-bubble`
      should be the same one from the parent, or a fresh one. It does not seem
      to use any of the editor configurations from the parent. - AB
     -->
    <div
      v-if="active"
      class="apos-link-control__dialog"
      :class="{
        'is-triggered': active,
        'has-selection': hasSelection
      }"
    >
      <AposContextMenuDialog
        menu-placement="bottom-start"
        v-if="active"
      >
        <form>
          <AposSchema
            :schema="schema"
            v-model="value"
            :modifiers="formModifiers"
          />
          <footer class="apos-link-control__footer">
            <AposButton
              type="default" label="Cancel"
              @click="close"
              :modifiers="formModifiers"
            />
            <AposButton
              type="primary" label="Save"
              @click="save"
              :modifiers="formModifiers"
            />
          </footer>
        </form>
      </AposContextMenuDialog>
    </div>
  </div>
</template>

<script>

import { EditorMenuBubble } from 'tiptap';
import { isEmpty } from 'lodash';

export default {
  name: 'AposTiptapLink',
  components: {
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
      formModifiers: [ 'small' ],
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
              label: 'Current tab (_self)',
              value: '_self'
            },
            {
              label: 'New tab (_blank)',
              value: '_blank'
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
    position: relative;
    display: inline-block;
  }

  .apos-link-control__dialog {
    z-index: $z-index-modal;
    position: absolute;
    top: calc(100% + 5px);
    left: -15px;
    width: 250px;
    opacity: 0;
    pointer-events: none;
  }

  .apos-link-control__dialog.is-triggered.has-selection {
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
