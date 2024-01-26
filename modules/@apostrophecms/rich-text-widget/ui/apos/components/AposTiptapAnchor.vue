<template>
  <div class="apos-anchor-control">
    <AposButton
      type="rich-text"
      :class="{ 'apos-is-active': buttonActive }"
      :label="tool.label"
      :icon-only="!!tool.icon"
      :icon="tool.icon || false"
      :modifiers="['no-border', 'no-motion']"
      :tooltip="{
        content: tool.label,
        placement: 'top',
        delay: 650
      }"
      @click="click"
    />
    <div
      v-if="active"
      v-click-outside-element="close"
      class="apos-popover apos-anchor-control__dialog"
      x-placement="bottom"
      :class="{
        'apos-is-triggered': active,
        'apos-has-selection': hasSelection
      }"
    >
      <AposContextMenuDialog
        menu-placement="bottom-start"
      >
        <div v-if="hasAnchorOnOpen" class="apos-anchor-control__remove">
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
      </AposContextMenuDialog>
    </div>
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
      ],
      active: false
    };
  },
  computed: {
    buttonActive() {
      return this.editor.isActive('anchor') || this.active;
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
    active(newVal) {
      if (newVal) {
        this.hasAnchorOnOpen = !!(this.docFields.data.anchor);
        window.addEventListener('keydown', this.keyboardHandler);
      } else {
        window.removeEventListener('keydown', this.keyboardHandler);
      }
    },
    'editor.view.input.lastSelectionTime': {
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
  async mounted() {
    await this.evaluateExternalConditions();
    this.evaluateConditions();
  },
  methods: {
    removeAnchor() {
      this.docFields.data = {};
      this.editor.commands.unsetAnchor();
      this.close();
    },
    click() {
      if (this.hasSelection) {
        this.active = !this.active;
        this.populateFields();
      }
    },
    close() {
      if (this.active) {
        this.active = false;
        this.editor.chain().focus();
      }
    },
    save() {
      this.triggerValidation = true;
      this.$nextTick(() => {
        if (this.docFields.hasErrors) {
          return;
        }
        this.editor.commands.setAnchor({
          id: this.docFields.data.anchor
        });
        this.close();
      });
    },
    keyboardHandler(e) {
      if (e.keyCode === 27) {
        this.close();
      }
      if (e.keyCode === 13) {
        if (this.docFields.data.anchor) {
          this.save();
          this.close();
          e.preventDefault();
        } else {
          e.preventDefault();
        }
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
    }
  }
};
</script>

<style lang="scss" scoped>
  .apos-anchor-control {
    position: relative;
    display: inline-block;
  }

  .apos-anchor-control__dialog {
    z-index: $z-index-modal;
    position: absolute;
    top: calc(100% + 5px);
    left: -15px;
    width: 250px;
    opacity: 0;
    pointer-events: none;
  }

  .apos-anchor-control__dialog.apos-is-triggered.apos-has-selection {
    opacity: 1;
    pointer-events: auto;
  }

  .apos-is-active {
    background-color: var(--a-base-7);
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
