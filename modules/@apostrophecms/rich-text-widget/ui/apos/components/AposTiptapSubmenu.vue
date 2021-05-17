<template>
  <div class="apos-tiptap-submenu">
    <!-- todo contextmenu -->
    <AposButton
      type="rich-text"
      @click="click"
      :class="{ 'apos-active': buttonActive }"
      :label="tool.label"
      :icon-only="!!tool.icon"
      :icon="tool.icon ? tool.icon : false"
      :modifiers="['no-border', 'no-motion']"
    />
    <div
      v-if="active"
      v-click-outside-element="close"
      class="apos-popover apos-tiptap-submenu__dialog"
      x-placement="bottom"
      :class="{
        'is-triggered': active,
        'has-selection': hasSelection
      }"
    >
      <AposContextMenuDialog
        v-if="active"
        menu-placement="bottom-start"
        :modifiers="['unpadded']"
      >
        <AposButtonGroup
          :modifiers="[]"
        >
          <AposButton
            v-for="item in items"
            :key="item.name"
            v-bind="getButton(item)"
            :disabled="false"
          />
        </AposButtonGroup>
      </AposContextMenuDialog>
    </div>
  </div>
</template>

<script>

import { EditorMenuBubble } from 'tiptap';
import { isEmpty } from 'lodash';

export default {
  name: 'AposTiptapSubmenu',
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
    },
    options: {
      type: Object,
      required: true
    }
  },
  data () {
    return {
      keepInBounds: true,
      href: null,
      target: null,
      active: false,
      hasLinkOnOpen: false,
      buttonDefaults: {
        iconOnly: true,
        type: 'group',
        // modifiers: [ 'tiny' ],
        role: 'menuitem'
      },
      value: {
        data: {}
      }
    };
  },
  computed: {
    buttonActive() {
      return !isEmpty(this.value.data);
    },
    items() {
      return this.tool.editorOptions.items;
    },
    hasSelection() {
      return this.editor.selection.from !== this.editor.selection.to;
    }
  },
  watch: {

  },
  methods: {
    click() {
      if (this.hasSelection) {
        this.active = !this.active;
        // this.populateFields();
      }
    },
    close() {
      this.active = false;
      this.editor.focus();
    },
    populateFields() {
      const attrs = this.editor.getMarkAttrs('link');
      this.value.data = {};
      this.schema.forEach((item) => {
        if (attrs[item.name]) {
          this.value.data[item.name] = attrs[item.name];
        }
      });
    },
    getButton(item) {
      return {
        ...this.buttonDefaults,
        icon: item.icon
      };
    }
  }
};
</script>

<style lang="scss" scoped>
  .apos-tiptap-submenu {
    position: relative;
    display: inline-block;
  }

  .apos-tiptap-submenu__dialog {
    z-index: $z-index-modal;
    position: absolute;
    top: calc(100% + 5px);
    left: -15px;
    width: 250px;
    opacity: 0;
    pointer-events: none;
  }

  .apos-tiptap-submenu__dialog.is-triggered.has-selection {
    opacity: 1;
    pointer-events: auto;
  }

  // .apos-active {
  //   background-color: var(--a-brand-blue);
  // }

  // .apos-link-control__footer {
  //   display: flex;
  //   justify-content: flex-end;
  //   margin-top: 10px;
  // }

  // .apos-link-control__footer .apos-button {
  //   margin-left: 7.5px;
  // }

  // .apos-link-control__remove {
  //   display: flex;
  //   justify-content: flex-end;
  // }

  // // special schema style for this use
  // .apos-link-control /deep/ .apos-field--target {
  //   .apos-field__label {
  //     display: none;
  //   }
  // }

</style>
