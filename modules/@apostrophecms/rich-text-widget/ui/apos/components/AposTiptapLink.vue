<template>
  <div class="apos-link-control">
    <AposButton
      type="rich-text"
      @click="click"
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
            @click="removeLink"
            label="apostrophe:removeLink"
          />
        </div>
        <AposSchema
          :schema="schema"
          :trigger-validation="triggerValidation"
          v-model="docFields"
          :modifiers="formModifiers"
          :key="lastSelectionTime"
          :generation="generation"
          :following-values="followingValues()"
          :conditional-fields="conditionalFields()"
        />
        <footer class="apos-link-control__footer">
          <AposButton
            type="default" label="apostrophe:cancel"
            @click="close"
            :modifiers="formModifiers"
          />
          <AposButton
            type="primary" label="apostrophe:save"
            @click="save"
            :modifiers="formModifiers"
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
    const linkWithType = getOptions().linkWithType;
    return {
      generation: 1,
      href: null,
      target: null,
      active: false,
      hasLinkOnOpen: false,
      triggerValidation: false,
      docFields: {
        data: {}
      },
      formModifiers: [ 'small', 'margin-micro' ],
      originalSchema: [
        {
          name: 'linkTo',
          label: this.$t('apostrophe:linkTo'),
          type: 'select',
          def: linkWithType[0],
          required: true,
          choices: [
            ...(linkWithType.map(type => {
              return {
                // Should already be localized server side
                label: apos.modules[type].label,
                value: type
              };
            })),
            {
              // TODO this needs i18n
              label: this.$t('apostrophe:url'),
              // Value that will never be a doc type
              value: '_url'
            }
          ]
        },
        ...getOptions().linkWithType.map(type => ({
          name: `_${type}`,
          type: 'relationship',
          label: apos.modules[type].label,
          withType: type,
          required: true,
          max: 1,
          browse: true,
          if: {
            linkTo: type
          }
        })),
        {
          name: 'updateTitle',
          label: this.$t('apostrophe:updateTitle'),
          type: 'boolean',
          def: true,
          if: {
            $or: linkWithType.map(type => ({
              linkTo: type
            }))
          }
        },
        {
          name: 'href',
          label: this.$t('apostrophe:url'),
          type: 'string',
          if: {
            linkTo: '_url'
          }
        },
        {
          name: 'target',
          label: this.$t('apostrophe:linkTarget'),
          type: 'checkboxes',
          choices: [
            {
              label: this.$t('apostrophe:openLinkInNewTab'),
              value: '_blank'
            }
          ]
        }
      ]
    };
  },
  computed: {
    buttonActive() {
      return this.editor.getAttributes('link').href || this.active;
    },
    lastSelectionTime() {
      return this.editor.view.lastSelectionTime;
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
        this.hasLinkOnOpen = !!(this.docFields.data.href);
        window.addEventListener('keydown', this.keyboardHandler);
      } else {
        window.removeEventListener('keydown', this.keyboardHandler);
      }
    },
    'editor.view.lastSelectionTime': {
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
    removeLink() {
      this.docFields.data = {};
      this.editor.commands.unsetLink();
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
        if (this.docFields.data.linkTo !== '_url') {
          const doc = this.docFields.data[`_${this.docFields.data.linkTo}`][0];
          this.docFields.data.href = `#apostrophe-permalink-${doc.aposDocId}?updateTitle=${this.docFields.data.updateTitle ? 1 : 0}`;
        }
        // Clean up incomplete submissions
        if (this.docFields.data.target && !this.docFields.data.href) {
          delete this.docFields.data.target;
        }
        this.editor.commands.setLink({
          target: this.docFields.data.target[0],
          href: this.docFields.data.href
        });
        this.close();
      });
    },
    keyboardHandler(e) {
      if (e.keyCode === 27) {
        this.close();
      }
      if (e.keyCode === 13) {
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
        const attrs = this.editor.getAttributes('link');
        if (attrs.target) {
          // checkboxes field expects an array
          attrs.target = [ attrs.target ];
        }
        this.docFields.data = {};
        this.schema.forEach((item) => {
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
            busy: true
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
  .apos-link-control ::v-deep .apos-field--target {
    .apos-field__label {
      display: none;
    }
  }

</style>
