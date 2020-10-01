<template>
  <div class="apos-media-manager-editor">
    <div class="apos-media-manager-editor__inner" v-if="activeMedia">
      <div class="apos-media-manager-editor__thumb-wrapper">
        <img
          v-if="activeMedia.attachment"
          class="apos-media-manager-editor__thumb"
          :src="activeMedia.attachment._urls['one-third']" :alt="activeMedia.description"
        >
      </div>
      <ul class="apos-media-manager-editor__details">
        <li class="apos-media-manager-editor__detail">
          {{ activeMedia.uploadedAt }}
        </li>
        <li class="apos-media-manager-editor__detail">
          File Size: {{ activeMedia.fileSize }}
        </li>
        <li class="apos-media-manager-editor__detail">
          {{ activeMedia.dim }}
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
    <AposModalConfirm
      v-if="confirmContent"
      @safe-close="confirmContent = null"
      :confirm-content="confirmContent"
      @confirm="discardChanges"
    />
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
      activeMedia: this.media,
      doc: {
        data: {},
        hasErrors: false
      },
      docEdited: false,
      lipKey: '',
      triggerValidation: false,
      confirmContent: null,
      changeConfirmed: false
    };
  },
  computed: {
    moduleOptions() {
      return window.apos.modules[this.activeMedia.type] || {};
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
          // If either old or new state are an empty object, it's not "edited"
          if (
            Object.keys(oldData).length > 0 &&
            Object.keys(newData).length > 0
          ) {
            this.docEdited = true;
          }
        });
      }
    },
    media(newVal) {
      if (
        this.docEdited && !this.changeConfirmed &&
        newVal._id !== this.activeMedia._id
      ) {
        this.confirmContent = {
          heading: 'Unsaved Changes',
          description: 'Do you want to discard changes to the active image?',
          affirmativeLabel: 'Discard Changes'
        };

        return;
      }

      this.updateActiveDoc(newVal);
    }
  },
  mounted() {
    this.generateLipKey();
    this.docEdited = false;
  },
  methods: {
    updateActiveDoc(newMedia) {
      this.activeMedia = newMedia;
      this.doc.data = klona(newMedia);
      this.generateLipKey();
    },
    save() {
      this.triggerValidation = true;
      apos.bus.$emit('busy', true);
      const route = `${this.moduleOptions.action}/${this.activeMedia._id}`;
      // Repopulate `attachment` since it was removed from the schema.
      this.doc.data.attachment = this.activeMedia.attachment;

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

          this.docEdited = false;
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
    },
    async discardChanges () {
      this.changeConfirmed = true;
      this.updateActiveDoc(this.media);

      await apos.notify(`${this.moduleLabels.label} changes discarded`, {
        dismiss: true
      });
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
