<template>
  <div class="apos-anchor-control">
    <AposContextMenu
      ref="contextMenu"
      menu-placement="bottom-end"
      :button="button"
      :rich-text-menu="true"
      @open="openPopover"
      @close="closePopover"
    >
      <div
        class="apos-popover apos-anchor-control__dialog"
        :class="{ 'apos-has-selection': hasSelection }"
      >
        <div
          v-if="hasAnchorOnOpen"
          class="apos-anchor-control__remove"
        >
          <AposButton
            type="quiet"
            label="apostrophe:removeRichTextAnchor"
            @click="removeAnchor"
          />
        </div>
        <AposSchema
          :key="lastSelectionTime"
          v-model="docFields"
          :schema="schema"
          :trigger-validation="triggerValidation"
          :modifiers="formModifiers"
          :generation="generation"
          :following-values="followingValues()"
          :conditional-fields="conditionalFields"
          @update:model-value="evaluateConditions()"
        />
        <footer class="apos-anchor-control__footer">
          <AposButton
            type="default"
            label="apostrophe:cancel"
            :modifiers="formModifiers"
            @click="close"
          />
          <AposButton
            type="primary"
            label="apostrophe:save"
            :modifiers="formModifiers"
            @click="save"
          />
        </footer>
      </div>
    </AposContextMenu>
  </div>
</template>

<script>
import AposEditorMixin from 'Modules/@apostrophecms/modal/mixins/AposEditorMixin';

export default {
  name: 'AposTiptapAnchor',
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
    }
  },
  emits: [ 'close' ],
  data () {
    return {
      generation: 1,
      hasAnchorOnOpen: false,
      triggerValidation: false,
      docFields: {
        data: {}
      },
      formModifiers: [ 'small', 'margin-micro' ],
      originalSchema: [
        {
          name: 'anchor',
          label: this.$t('apostrophe:anchorId'),
          type: 'string',
          required: true
        }
      ]
    };
  },
  computed: {
    button() {
      return {
        ...this.buttonActive ? { class: 'apos-is-active' } : {},
        type: 'rich-text',
        label: this.tool.label,
        'icon-only': Boolean(this.tool.icon),
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
    buttonActive() {
      return this.editor.isActive('anchor');
    },
    lastSelectionTime() {
      return this.editor.view.input.lastSelectionTime;
    },
    hasSelection() {
      const { state } = this.editor;
      const { selection } = this.editor.state;
      const { from, to } = selection;
      const text = state.doc.textBetween(from, to, '');
      return text !== '';
    },
    schema() {
      return this.originalSchema;
    }
  },
  watch: {
    'editor.view.input.lastSelectionTime': {
      handler() {
        this.populateFields();
      }
    },
    hasSelection(newVal) {
      if (!newVal) {
        this.close();
      }
    }
  },
  async mounted() {
    await this.evaluateExternalConditions();
  },
  methods: {
    removeAnchor() {
      this.docFields.data = {};
      this.editor.commands.unsetAnchor();
      this.editor.chain().focus().blur().run();
      this.close();
    },
    close() {
      this.$refs.contextMenu.hide();
    },
    async save() {
      this.triggerValidation = true;
      await this.$nextTick();

      if (this.docFields.hasErrors) {
        return;
      }
      this.editor.commands.setAnchor({
        id: this.docFields.data.anchor
      });
      this.editor.chain().focus().blur().run();
      this.close();
    },
    keyboardHandler(e) {
      if (e.key === 'Escape') {
        this.close();
      }
      if (e.key === 'Enter') {
        if (this.docFields.data.anchor) {
          this.save();
          this.close();
        }
        e.preventDefault();
      }
    },
    async populateFields() {
      try {
        const attrs = {
          anchor: this.editor.getAttributes('anchor').id
        };
        this.docFields.data = {};
        this.schema.forEach((item) => {
          this.docFields.data[item.name] = attrs[item.name] || '';
        });
      } finally {
        this.generation++;
      }
    },
    async openPopover() {
      await this.populateFields();
      this.evaluateConditions();
      this.hasAnchorOnOpen = Boolean(this.docFields.data.anchor);
      window.addEventListener('keydown', this.keyboardHandler);
    },
    closePopover() {
      window.removeEventListener('keydown', this.keyboardHandler);
      this.$emit('close');
    }
  }
};
</script>

<style lang="scss" scoped>
  .apos-anchor-control__dialog.apos-is-triggered.apos-has-selection {
    opacity: 1;
    pointer-events: auto;
  }

  .apos-anchor-control__footer {
    display: flex;
    justify-content: flex-end;
    margin-top: 10px;
  }

  .apos-anchor-control__footer .apos-button__wrapper {
    margin-left: 7.5px;
  }

  .apos-anchor-control__remove {
    display: flex;
    justify-content: flex-end;
  }

  // special schema style for this use
  .apos-anchor-control :deep(.apos-field--target) {
    .apos-field__label {
      display: none;
    }
  }

</style>
