<template>
  <div
    class="apos-popover apos-image-control__dialog"
    :class="{ 'apos-has-selection': hasSelection }"
  >
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
    <footer class="apos-image-control__footer">
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
  </div>
</template>

<script>
import AposEditorMixin from 'Modules/@apostrophecms/modal/mixins/AposEditorMixin';

export default {
  name: 'AposImageControlDialog',
  mixins: [ AposEditorMixin ],
  props: {
    editor: {
      type: Object,
      required: true
    },
    hasSelection: {
      type: Boolean,
      default: false
    }
  },
  emits: [ 'before-commands', 'close' ],
  data() {
    const moduleOptions = apos.modules['@apostrophecms/rich-text-widget'];
    return {
      moduleOptions,
      generation: 1,
      triggerValidation: false,
      docFields: {
        data: {}
      },
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
          browse: true
        },
        ...(moduleOptions.imageStyles
          ? [
            {
              name: 'style',
              label: this.$t('apostrophe:style'),
              type: 'select',
              choices: moduleOptions.imageStyles,
              def: moduleOptions.imageStyles?.[0].value,
              required: true
            }
          ]
          : []
        ),
        {
          name: 'caption',
          label: this.$t('apostrophe:caption'),
          type: 'string',
          def: ''
        }
      ]
    };
  },
  computed: {
    attributes() {
      return this.editor.getAttributes('image');
    },
    lastSelectionTime() {
      return this.editor.view.input.lastSelectionTime;
    },
    schema() {
      return this.originalSchema;
    }
  },
  watch: {
    'attributes.imageId': {
      handler(newVal, oldVal) {
        if (newVal === oldVal) {
          return;
        }

        this.close();
      }
    },
    lastSelectionTime(newVal, oldVal) {
      if (newVal === oldVal) {
        return;
      }

      this.populateFields();
      this.evaluateConditions();
    }
  },
  async mounted() {
    this.populateFields();
    await this.evaluateExternalConditions();
    this.evaluateConditions();
    window.addEventListener('keydown', this.keyboardHandler);
  },
  beforeUnmount() {
    window.removeEventListener('keydown', this.keyboardHandler);
  },
  methods: {
    close() {
      this.$emit('close');
    },
    save() {
      this.triggerValidation = true;
      this.$nextTick(() => {
        if (this.docFields.hasErrors) {
          return;
        }
        const image = this.docFields.data._image[0];
        this.docFields.data.imageId = image && image.aposDocId;
        this.docFields.data.alt = image && image.alt;
        this.$emit('before-commands');
        this.editor.commands.setImage({
          imageId: this.docFields.data.imageId,
          caption: this.docFields.data.caption,
          style: this.docFields.data.style,
          alt: this.docFields.data.alt
        });
        this.close();
      });
    },
    keyboardHandler(e) {
      if (e.key === 'Escape') {
        this.close();
      }
      if (e.key === 'Enter') {
        if (this.docFields.data._image?.length || e.metaKey) {
          this.save();
          this.close();
        }
        e.preventDefault();
      }
    },
    async populateFields() {
      try {
        const attrs = this.attributes;
        this.docFields.data = {};
        this.schema.forEach((item) => {
          this.docFields.data[item.name] = attrs[item.name] || '';
        });
        const defaultStyle = this.moduleOptions.imageStyles?.[0]?.value;
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
</script>

<style lang="scss" scoped>
  .apos-image-control__dialog {
    width: 400px;
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
  .apos-image-control :deep(.apos-field--target) {
    .apos-field__label {
      display: none;
    }
  }

</style>
