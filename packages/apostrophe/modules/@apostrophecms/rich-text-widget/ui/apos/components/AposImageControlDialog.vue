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
        :modifiers="['small']"
        @click="close"
      />
      <AposButton
        type="primary"
        label="apostrophe:save"
        :modifiers="['small']"
        :disabled="docFields.hasErrors"
        @click="save"
      />
    </footer>
  </div>
</template>

<script>
import AposEditorMixin from 'Modules/@apostrophecms/modal/mixins/AposEditorMixin';
import { klona } from 'klona';

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
    const moduleOptions = klona(apos.modules['@apostrophecms/rich-text-widget']);
    // Grab only the fields that are image-related if explicitly set
    // set in the schema.
    const linkToOptions = moduleOptions.linkSchema
      .find(field => field.name === 'linkTo')?.choices || [];
    const linkSchema = moduleOptions.linkSchema
      .filter(field => !field.extensions || field.extensions.includes('Image'))
      .map(field => {
        if (field.htmlAttribute) {
          field.htmlTag = 'a';
          field.if = {
            $or: linkToOptions.map(option => ({
              linkTo: option.value
            })).concat(field.if?.$or || [])
          };
        }
        return field;
      });
    linkToOptions.unshift({
      label: this.$t('apostrophe:none'),
      value: 'none'
    });
    return {
      moduleOptions,
      generation: 1,
      triggerValidation: false,
      docFields: {
        data: {}
      },
      formModifiers: [ 'micro' ],
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
        },
        ...linkSchema
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
    },
    schemaHtmlAttributes() {
      return this.schema.filter(item => !!item.htmlAttribute);
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
        const doc = this.docFields.data[`_${this.docFields.data.linkTo}`]?.[0];
        if (doc && this.docFields.data.linkTo !== '_url') {
          this.docFields.data.href = `#apostrophe-permalink-${doc.aposDocId}`;
        }
        const image = this.docFields.data._image[0];
        this.docFields.data.imageId = image && image.aposDocId;
        this.docFields.data.alt = image && image.alt;
        this.$emit('before-commands');
        this.editor.commands.setImage(this.getTipTapAttributes());
        this.close();
      });
    },
    getTipTapAttributes() {
      const image = this.docFields.data._image?.[0];
      const attrs = {
        imageId: this.docFields.data.imageId,
        caption: this.docFields.data.caption,
        style: this.docFields.data.style,
        ...this.schemaHtmlAttributes.reduce((acc, field) => {
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
        }, {})
      };
      if (image) {
        attrs.alt = image.alt;
      }
      // external link, noopener noreferrer merged with
      // eventual rel attribute
      const relField = this.schemaHtmlAttributes.find(item => item.htmlAttribute === 'rel');
      if (this.docFields.data.target?.includes('_blank') && this.docFields.data.linkTo === '_url') {
        let rel = 'noopener noreferrer';
        if (relField) {
          rel += ` ${this.docFields.data[relField.htmlAttribute] || ''}`;
        }
        rel = new Set(rel.trim().split(' ').filter(Boolean));
        attrs.rel = [ ...rel ].join(' ');
      } else {
        attrs.rel = relField
          ? this.docFields.data[relField.htmlAttribute] || null
          : null;
      }
      // href & title
      switch (this.docFields.data.linkTo) {
        case 'none': {
          attrs.href = null;
          attrs.title = null;
          this.schemaHtmlAttributes.forEach((item) => {
            if (item.htmlAttribute && item.htmlTag === 'a') {
              attrs[item.htmlAttribute] = null;
            }
          });
          break;
        }
        case '_url': {
          attrs.href = this.docFields.data.href;
          attrs.title = this.docFields.data.hrefTitle || this.docFields.data.caption;
          attrs.target = this.docFields.data.target?.[0] || null;
          break;
        }
        default: {
          const doc = this.docFields.data[`_${this.docFields.data.linkTo}`]?.[0];
          attrs.title = this.docFields.data.title || doc?.title;
          attrs.target = this.docFields.data.target?.[0] || null;
          if (doc) {
            attrs.href = `#apostrophe-permalink-${doc.aposDocId}`;
          }
        }
      }
      return attrs;
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
          if (item.htmlAttribute && item.type === 'checkboxes') {
            this.docFields.data[item.name] = attrs[item.htmlAttribute]
              ? [ attrs[item.htmlAttribute] ]
              : [];
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
        const matches = attrs.href?.match(/^#apostrophe-permalink-(.*)$/);
        let doc;
        if (!matches) {
          this.docFields.data.linkTo = attrs.href ? '_url' : 'none';
        } else {
          try {
            doc = await apos.http.get(`/api/v1/@apostrophecms/doc/${matches[1]}`, {
              busy: true,
              draft: true
            });
            this.docFields.data.linkTo = doc.slug.startsWith('/') ? '@apostrophecms/any-page-type' : doc.type;
            this.docFields.data[`_${this.docFields.data.linkTo}`] = [ doc ];
          } catch (e) {
            // No longer available
            if (e.status === 404) {
              this.docFields.data[`_${this.docFields.data.linkTo}`] = [];
            } else {
              throw e;
            }
          }
        }
        switch (this.docFields.data.linkTo) {
          case 'none': {
            this.docFields.data.title = '';
            this.docFields.data.hrefTitle = '';
            this.docFields.data.href = '';
            break;
          }
          case '_url': {
            this.docFields.data.hrefTitle = attrs.title;
            this.docFields.data.title = '';
            break;
          }
          default: {
            this.docFields.data.title = doc?.title && attrs.title === doc?.title
              ? ''
              : attrs.title;
            this.docFields.data.hrefTitle = '';
            this.docFields.data.href = '';
          }
        }
      } finally {
        this.generation++;
        this.evaluateConditions();
      }
    }
  }
};
</script>

<style lang="scss" scoped>
  .apos-image-control__dialog {
    width: 340px;
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

  :deep(.apos-schema .apos-field.apos-field--micro) {
    margin-bottom: $spacing-base + $spacing-half;
  }
</style>
