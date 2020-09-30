<template>
  <div class="apos-media-manager-editor">
    <div class="apos-media-manager-editor__inner" v-if="media">
      <div class="apos-media-manager-editor__thumb-wrapper">
        <img
          v-if="media.attachment"
          class="apos-media-manager-editor__thumb"
          :src="media.attachment._urls['one-third']" :alt="media.description"
        >
      </div>
      <ul class="apos-media-manager-editor__details">
        <li class="apos-media-manager-editor__detail">
          {{ media.uploadedAt }}
        </li>
        <li class="apos-media-manager-editor__detail">
          File Size: {{ media.fileSize }}
        </li>
        <li class="apos-media-manager-editor__detail">
          {{ media.dim }}
        </li>
      </ul>
      <AposSchema
        v-if="doc.data.title !== undefined"
        :schema="schema"
        v-model="doc"
        :modifiers="['small', 'inverted']"
        :trigger-validation="triggerValidation"
        :doc-id="doc.data._id"
        @reset="docEdited = false"
      />
    </div>
    <AposModalLip :refresh="lipKey">
      <div
        class="apos-media-manager-editor__lip"
      >
        <AposButton
          @click="$emit('back')"
          class="apos-media-manager-editor__back" type="outline"
          label="Cancel"
        />
        <AposButton
          @click="save" class="apos-media-manager-editor__save"
          :disabled="doc.hasErrors"
          label="Save" type="primary"
        />
      </div>
    </AposModalLip>
  </div>
</template>

<script>
import AposHelpers from 'Modules/@apostrophecms/ui/mixins/AposHelpersMixin';
import klona from 'klona';

export default {
  mixins: [ AposHelpers ],
  props: {
    media: {
      type: Object,
      default() {
        return {};
      }
    },
    selected: {
      type: Array,
      default() {
        return [];
      }
    },
    moduleLabels: {
      type: Object,
      default() {
        return {
          label: 'Image',
          pluralLabel: 'Images'
        };
      }
    }
  },
  emits: [ 'saved', 'back' ],
  data() {
    return {
      doc: {
        data: {},
        hasErrors: false
      },
      docEdited: false,
      lipKey: '',
      triggerValidation: false
    };
  },
  computed: {
    moduleOptions() {
      return window.apos.modules[this.media.type] || {};
    },
    schema() {
      if (this.moduleOptions.schema) {
        return this.moduleOptions.schema.filter(field => {
          return field.type !== 'attachment';
        });
      }
      return [];
    }
  },
  watch: {
    'doc.data': {
      deep: true,
      handler(newData, oldData) {
        this.$nextTick(() => {
          // If the previous state was an empty object, it's not "edited"
          if (Object.keys(oldData).length > 0) {
            this.docEdited = true;
          }
        });
      }
    },
    media(newVal) {
      this.doc.data = klona(newVal);
      this.generateLipKey();
    }
  },
  mounted() {
    this.generateLipKey();
    this.docEdited = false;
  },
  methods: {
    save() {
      this.triggerValidation = true;
      apos.bus.$emit('busy', true);
      const route = `${this.moduleOptions.action}/${this.media._id}`;
      // Repopulate `attachment` since it was removed from the schema.
      this.doc.data.attachment = this.media.attachment;
      this.$nextTick(async () => {
        if (this.doc.hasErrors) {
          await apos.notify('Resolve errors before saving.', {
            type: 'warning',
            icon: 'alert-circle-icon',
            dismiss: true
          });
          return;
        }

        try {
          await apos.http.put(route, {
            busy: true,
            body: this.doc.data
          });

          this.$emit('saved');
        } catch (err) {
          console.error('Error saving image', err);

          await apos.notify(`Error Saving ${this.moduleLabels.label}`, {
            type: 'danger',
            icon: 'alert-circle-icon',
            dismiss: true
          });
        } finally {
          apos.bus.$emit('busy', false);
        }
      });
    },
    generateLipKey() {
      this.lipKey = this.generateId();
    }
  }
};
</script>

<style lang="scss" scoped>
  .apos-media-manager-editor {
    position: relative;
    height: 100%;
    padding: 20px;
  }

  .apos-media-manager-editor__thumb-wrapper {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 180px;
    border: 1px solid var(--a-base-7);
    margin-bottom: 20px;
  }
  .apos-media-manager-editor__thumb {
    max-width: 100%;
    max-height: 100%;
  }

  .apos-media-manager-editor /deep/ .apos-field {
    margin-bottom: 20px;
  }

  .apos-media-manager-editor__details {
    @include apos-list-reset();
    color: var(--a-base-4);
    font-size: map-get($font-sizes, default);
    font-weight: 500;
    margin-bottom: 20px;
  }

  .apos-media-manager-editor__controls {
    margin-bottom: 20px;
  }

  .apos-media-manager-editor__lip {
    display: flex;
    justify-content: space-between;
  }
</style>
