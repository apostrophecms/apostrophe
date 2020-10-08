<template>
  <div
    class="apos-media-editor"
    :class="{
      'is-replacing': allowReplace
    }"
  >
    <div class="apos-media-editor__inner" v-if="activeMedia">
      <div class="apos-media-editor__thumb-wrapper">
        <img
          v-if="activeMedia.attachment && activeMedia.attachment._urls"
          class="apos-media-editor__thumb"
          :src="activeMedia.attachment._urls['one-third']" :alt="activeMedia.description"
        >
      </div>
      <ul class="apos-media-editor__details">
        <li class="apos-media-editor__detail" v-if="createdDate">
          Uploaded: {{ createdDate }}
        </li>
        <li class="apos-media-editor__detail" v-if="fileSize">
          File Size: {{ fileSize }}
        </li>
        <li
          class="apos-media-editor__detail"
          v-if="activeMedia.attachment && activeMedia.attachment.width"
        >
          Dimensions: {{ activeMedia.attachment.width }} 𝗑
          {{ activeMedia.attachment.height }}
        </li>
      </ul>
      <ul class="apos-media-editor__links">
        <li class="apos-media-editor__link" aria-hidden="true">
          <AposButton
            type="quiet" label="Replace"
            @click="allowReplace = true"
          />
        </li>
        <li class="apos-media-editor__link" v-if="activeMedia.attachment._urls">
          <AposButton
            type="quiet" label="View"
            @click="viewMedia"
          />
        </li>
      </ul>
      <AposSchema
        v-if="doc.data.title !== undefined"
        :schema="schema"
        v-model="doc"
        :modifiers="['small', 'inverted']"
        :trigger-validation="triggerValidation"
        :doc-id="doc.data._id"
        :following-values="followingValues()"
        @reset="docEdited = false"
      />
    </div>
    <AposModalLip :refresh="lipKey">
      <div
        class="apos-media-editor__lip"
      >
        <AposButton
          @click="cancel"
          class="apos-media-editor__back" type="outline"
          label="Cancel"
        />
        <AposButton
          @click="save" class="apos-media-editor__save"
          :disabled="doc.hasErrors"
          label="Save" type="primary"
        />
      </div>
    </AposModalLip>
    <AposModalConfirm
      v-if="confirmingDiscard"
      @safe-close="confirmingDiscard = false"
      :confirm-content="confirmContent"
      @confirm="discardChanges"
    />
  </div>
</template>

<script>
import AposHelpers from 'Modules/@apostrophecms/ui/mixins/AposHelpersMixin';
import AposEditorMixin from 'Modules/@apostrophecms/modal/mixins/AposEditorMixin';
import klona from 'klona';
import dayjs from 'dayjs';
import { isEqual } from 'lodash';
import advancedFormat from 'dayjs/plugin/advancedFormat';
dayjs.extend(advancedFormat);

export default {
  mixins: [ AposHelpers, AposEditorMixin ],
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
      // Primarily use `activeMedia` to support hot-swapping image docs.
      activeMedia: klona(this.media),
      doc: {
        data: {},
        hasErrors: false
      },
      docEdited: false,
      lipKey: '',
      triggerValidation: false,
      confirmContent: {
        heading: 'Unsaved Changes',
        description: 'Do you want to discard changes to the active image?',
        affirmativeLabel: 'Discard Changes'
      },
      confirmingDiscard: false,
      discardConfirmed: false,
      allowReplace: false
    };
  },
  computed: {
    moduleOptions() {
      return window.apos.modules[this.activeMedia.type] || {};
    },
    schema() {
      if (this.moduleOptions.schema) {
        return this.moduleOptions.schema;
      }
      return [];
    },
    fileSize() {
      if (
        !this.activeMedia.attachment || !this.activeMedia.attachment.length ||
        !this.activeMedia.attachment.length.size
      ) {
        return '';
      }

      const size = this.activeMedia.attachment.length.size;

      if (size >= 1000000) {
        return `${(size / 1000000).toFixed(2)}MB`;
      } else {
        return `${Math.round(size / 1000)}KB`;
      }
    },
    createdDate() {
      if (!this.activeMedia.attachment || !this.activeMedia.attachment.createdAt) {
        return '';
      }
      return dayjs(this.activeMedia.attachment.createdAt).format('MMM Do, YYYY');
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

        if ((this.activeMedia.attachment && !newData.attachment)) {
          this.updateActiveAttachment({});
        } else if (
          (newData.attachment && !this.activeMedia.attachment) ||
          (this.activeMedia.attachment && !newData.attachment) ||
          !isEqual(newData.attachment, this.activeMedia.attachment)
        ) {
          this.updateActiveAttachment(newData.attachment);
        }
      }

    },
    media(newVal) {
      // Ask for comfirmation to change the active media if the doc was edited,
      // we haven't confirmed it's okay to discard it yet, there's existing
      // active media to replace, and that new media is different from the
      // active media.
      if (
        this.docEdited && !this.discardConfirmed &&
        this.activeMedia._id && (newVal._id !== this.activeMedia._id)
      ) {
        this.confirmingDiscard = true;

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
      this.allowReplace = false;
      this.activeMedia = klona(newMedia);
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
          this.allowReplace = false;
          apos.bus.$emit('busy', false);
        }
      });
    },
    generateLipKey() {
      this.lipKey = this.generateId();
    },
    cancel() {
      // If the doc was edited and we haven't confirmed the discard yet, ask
      // for confirmation.
      if (this.docEdited && !this.discardConfirmed) {
        this.confirmingDiscard = true;

        return;
      }
      this.allowReplace = false;
      this.$emit('back');
    },
    async discardChanges () {
      this.discardConfirmed = true;

      if (this.media._id !== this.activeMedia._id) {
        this.updateActiveDoc(this.media);
      } else {
        this.updateActiveDoc({});
        this.cancel();
      }

      this.discardConfirmed = false;

      await apos.notify(`${this.moduleLabels.label} changes discarded`, {
        dismiss: true
      });
    },
    updateActiveAttachment(attachment) {
      console.info('☄️', attachment);
      this.activeMedia.attachment = attachment;
    },
    viewMedia () {
      window.open(this.activeMedia.attachment._urls.original, '_blank');
    }
  }
};
</script>

<style lang="scss" scoped>
  .apos-media-editor {
    position: relative;
    height: 100%;
    padding: 20px;
  }

  .apos-media-editor__thumb-wrapper {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 180px;
    border: 1px solid var(--a-base-7);
    margin-bottom: 20px;
  }
  .apos-media-editor__thumb {
    max-width: 100%;
    max-height: 100%;
  }

  .apos-media-editor /deep/ .apos-field {
    margin-bottom: 20px;
  }

  .apos-media-editor__details {
    @include apos-list-reset();
    color: var(--a-base-4);
    font-size: map-get($font-sizes, default);
    font-weight: 500;
    margin-bottom: 20px;
  }

  .apos-media-editor__links {
    @include apos-list-reset();
    margin-bottom: 30px;
  }

  .apos-media-editor__link {
    display: inline-block;
    & + & {
      margin-left: 20px;
    }
  }

  /deep/ [data-apos-field='attachment'] {
    .apos-media-editor:not(.is-replacing) & {
      position: absolute;
      left: -999rem;
      opacity: 0;
    }
  }

  .apos-media-editor__controls {
    margin-bottom: 20px;
  }

  .apos-media-editor__lip {
    display: flex;
    justify-content: space-between;
  }
</style>
