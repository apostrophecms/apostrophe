<template>
  <div class="apos-image-control">
    <AposButton
      type="rich-text"
      @click="click"
      :class="{ 'apos-is-active': buttonActive }"
      :label="tool.label"
      :icon-only="!!tool.icon"
      :icon="tool.icon || false"
      :modifiers="['no-border', 'no-motion']"
    />
    <div
      v-if="active"
      v-click-outside-element="close"
      class="apos-popover apos-image-control__dialog"
      x-placement="bottom"
      :class="{
        'apos-is-triggered': active,
        'apos-has-selection': true
      }"
    >
      <AposContextMenuDialog
        menu-placement="bottom-start"
      >
        <AposSchema
          :schema="schema"
          :trigger-validation="triggerValidation"
          v-model="docFields"
          :utility-rail="false"
          :modifiers="formModifiers"
          :key="lastSelectionTime"
          :generation="generation"
          :following-values="followingValues()"
          :conditional-fields="conditionalFields()"
        />
        <footer class="apos-image-control__footer">
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
  name: 'AposTiptapImage',
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
      triggerValidation: false,
      docFields: {
        data: {}
      },
      active: false,
      formModifiers: [ 'small', 'margin-micro' ],
      originalSchema: [
        {
          name: '_image',
          type: 'relationship',
          label: apos.image.label,
          withType: '@apostrophecms/image',
          required: true,
          max: 1,
          // Temporary until we fix our modals to
          // stack interchangeably with tiptap's
          browse: false
        },
        ...(getOptions().imageStyles ? [
          {
            name: 'style',
            label: this.$t('apostrophe:style'),
            type: 'select',
            choices: getOptions().imageStyles,
            def: getOptions().imageStyles?.[0].value,
            required: true
          }
        ] : []
        ),
        {
          name: 'caption',
          label: this.$t('apostrophe:caption'),
          type: 'string'
        }
      ]
    };
  },
  computed: {
    buttonActive() {
      return this.editor.getAttributes('img').src || this.active;
    },
    lastSelectionTime() {
      return this.editor.view.lastSelectionTime;
    },
    schema() {
      return this.originalSchema;
    }
  },
  watch: {
    active(newVal) {
      if (newVal) {
        window.addEventListener('keydown', this.keyboardHandler);
      } else {
        window.removeEventListener('keydown', this.keyboardHandler);
      }
    }
  },
  methods: {
    click() {
      this.active = !this.active;
      if (this.active) {
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
        const image = this.docFields.data._image[0];
        this.docFields.data.imageId = image && image.aposDocId;
        this.editor.commands.setImage({
          imageId: this.docFields.data.imageId,
          caption: this.docFields.data.caption,
          style: this.docFields.data.style
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
        const attrs = this.editor.getAttributes('image');
        this.docFields.data = {};
        this.schema.forEach((item) => {
          this.docFields.data[item.name] = attrs[item.name] || '';
        });
        const defaultStyle = getOptions().imageStyles?.[0]?.value;
        if (defaultStyle && !this.docFields.data.style) {
          this.docFields.data.style = defaultStyle;
        }
        if (attrs.imageId) {
          try {
            const doc = await apos.http.get(`/api/v1/@apostrophecms/image/${attrs.imageId}`, {
              busy: true
            });
            this.docFields.data._image = [ doc ];
          } catch (e) {
            if (e.status === 404) {
              // No longer available
              this.docFields._image = [];
            } else {
              throw e;
            }
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
  .apos-image-control {
    position: relative;
    display: inline-block;
  }

  .apos-image-control__dialog {
    z-index: $z-index-modal;
    position: absolute;
    top: calc(100% + 5px);
    left: -15px;
    width: 250px;
    opacity: 0;
    pointer-events: none;
  }

  .apos-image-control__dialog.apos-is-triggered {
    opacity: 1;
    pointer-events: auto;
  }

  .apos-is-active {
    background-color: var(--a-base-7);
  }

  .apos-image-control__footer {
    display: flex;
    justify-content: flex-end;
    margin-top: 10px;
  }

  .apos-image-control__footer .apos-button__wrapper {
    margin-left: 7.5px;
  }

  .apos-image-control__remove {
    display: flex;
    justify-content: flex-end;
  }

  // special schema style for this use
  .apos-image-control ::v-deep .apos-field--target {
    .apos-field__label {
      display: none;
    }
  }

</style>
