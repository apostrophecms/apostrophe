<template>
  <div class="apos-link-control">
    <AposButton
      type="rich-text"
      :class="{ 'apos-is-active': buttonActive }"
      :label="tool.label"
      :icon-only="!!tool.icon"
      :icon="tool.icon || false"
      :icon-size="tool.iconSize || 16"
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
      class="apos-popover apos-link-control__dialog"
      x-placement="bottom"
      :class="{
        'apos-is-triggered': active,
        'apos-has-selection': hasSelection
      }"
    >
      <AposContextMenuDialog
        menu-placement="bottom-start"
      >
        <div v-if="hasLinkOnOpen" class="apos-link-control__remove">
          <AposButton
            type="quiet"
            label="apostrophe:removeLink"
            @click="removeLink"
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
        <footer class="apos-link-control__footer">
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
            :disabled="docFields.hasErrors"
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
  name: 'AposTiptapLink',
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
  data() {

    return {
      generation: 1,
      href: null,
      // target: null,
      active: false,
      hasLinkOnOpen: false,
      triggerValidation: false,
      docFields: {
        data: {}
      },
      formModifiers: [ 'small', 'margin-micro' ],
      originalSchema: getOptions().linkSchema
    };
  },
  computed: {
    attributes() {
      return this.editor.getAttributes('link');
    },
    buttonActive() {
      return this.attributes.href || this.active;
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
    },
    schemaHtmlAttributes() {
      return this.schema.filter(item => !!item.htmlAttribute);
    }
  },
  watch: {
    'attributes.href': {
      handler(newVal, oldVal) {
        if (newVal === oldVal) {
          return;
        }

        this.close();
      }
    },
    active(newVal) {
      if (newVal) {
        this.hasLinkOnOpen = !!(this.attributes.href);
        window.addEventListener('keydown', this.keyboardHandler);
      } else {
        window.removeEventListener('keydown', this.keyboardHandler);
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
    removeLink() {
      this.docFields.data = {};
      this.editor.commands.unsetLink();
      this.close();
    },
    click() {
      if (this.hasSelection) {
        this.active = !this.active;
        this.populateFields();
        this.evaluateConditions();
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
        if (this.docFields.data.linkTo !== '_url') {
          const doc = this.docFields.data[`_${this.docFields.data.linkTo}`][0];
          this.docFields.data.href = `#apostrophe-permalink-${doc.aposDocId}?updateTitle=${this.docFields.data.updateTitle ? 1 : 0}`;
        }
        // Clean up incomplete submissions
        if (this.docFields.data.target && !this.docFields.data.href) {
          delete this.docFields.data.target;
        }

        const attrs = this.schemaHtmlAttributes.reduce((acc, field) => {
          const value = this.docFields.data[field.name];
          if (field.type === 'checkboxes' && !value?.[0]) {
            return acc;
          }
          if (field.type === 'boolean') {
            acc[field.htmlAttribute] = value === true ? '' : null;
            return acc;
          }
          acc[field.htmlAttribute] = Array.isArray(value) ? value[0] : value;
          return acc;
        }, {});
        attrs.href = this.docFields.data.href;
        this.editor.commands.setLink(attrs);

        this.close();
      });
    },
    keyboardHandler(e) {
      if (e.key === 'Escape') {
        this.close();
      }
      if (e.key === 'Enter') {
        if (this.docFields.data.href || e.metaKey) {
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
        const attrs = { ...this.attributes };
        this.docFields.data = {};
        this.schema.forEach((item) => {
          if (item.htmlAttribute && item.type === 'checkboxes') {
            this.docFields.data[item.name] = attrs[item.htmlAttribute] ? [ attrs[item.htmlAttribute] ] : [];
            return;
          }
          if (item.htmlAttribute && item.type === 'boolean') {
            this.docFields.data[item.name] = attrs[item.htmlAttribute] === null
              ? null
              : (attrs[item.htmlAttribute] === '');
            return;
          }
          if (item.htmlAttribute) {
            this.docFields.data[item.name] = attrs[item.htmlAttribute] || '';
            return;
          }
          this.docFields.data[item.name] = attrs[item.name] || '';
        });
        const matches = this.docFields.data.href.match(/^#apostrophe-permalink-(.*)\?updateTitle=(\d)$/);
        if (!matches) {
          this.docFields.data.updateTitle = true;
          this.docFields.data.linkTo = '_url';
          return;
        }
        // Never expose the special link format for permalinks in the UI
        this.docFields.data.href = '';
        try {
          const doc = await apos.http.get(`/api/v1/@apostrophecms/doc/${matches[1]}`, {
            busy: true,
            draft: true
          });
          this.docFields.data.linkTo = doc.slug.startsWith('/') ? '@apostrophecms/any-page-type' : doc.type;
          this.docFields.data[`_${this.docFields.data.linkTo}`] = [ doc ];
          this.docFields.data.updateTitle = !!parseInt(matches[2]);
        } catch (e) {
          if (e.status === 404) {
            // No longer available
            this.docFields.data.updateTitle = true;
            this.docFields.linkTo = 'url';
          } else {
            throw e;
          }
        }
      } finally {
        this.generation++;
      }
      this.evaluateConditions();
    }
  }
};

function getOptions() {
  return apos.modules['@apostrophecms/rich-text-widget'];
}
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
    opacity: 0;
    pointer-events: none;
  }

  .apos-context-menu__dialog {
    width: 500px;
  }

  .apos-link-control__dialog.apos-is-triggered.apos-has-selection {
    opacity: 1;
    pointer-events: auto;
  }

  .apos-is-active {
    background-color: var(--a-base-7);
  }

  .apos-link-control__footer {
    display: flex;
    justify-content: flex-end;
    margin-top: 10px;
  }

  .apos-link-control__footer .apos-button__wrapper {
    margin-left: 7.5px;
  }

  .apos-link-control__remove {
    display: flex;
    justify-content: flex-end;
  }

  // special schema style for this use
  .apos-link-control :deep(.apos-field--checkboxes) {
    .apos-field__label {
      display: none;
    }
  }

</style>
