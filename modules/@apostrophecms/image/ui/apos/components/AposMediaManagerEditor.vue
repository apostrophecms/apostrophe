<template>
  <div
    class="apos-media-editor"
    :class="{
      'is-replacing': showReplace
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
            @click="showReplace = true"
          />
        </li>
        <li class="apos-media-editor__link" v-if="activeMedia.attachment && activeMedia.attachment._urls">
          <AposButton
            type="quiet" label="View"
            @click="viewMedia"
          />
        </li>
        <li class="apos-media-editor__link" v-if="activeMedia.attachment && activeMedia.attachment._urls">
          <AposButton
            type="quiet" label="Download"
            :href="activeMedia.attachment._urls.original"
            download
          />
        </li>
      </ul>
      <AposSchema
        v-if="docFields.data.title !== undefined"
        :schema="schema"
        v-model="docFields"
        :modifiers="['small', 'inverted']"
        :trigger-validation="triggerValidation"
        :doc-id="docFields.data._id"
        :following-values="followingValues()"
        @reset="$emit('modified', false)"
        ref="schema"
        :server-errors="serverErrors"
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
          :disabled="docFields.hasErrors"
          label="Save" type="primary"
        />
      </div>
    </AposModalLip>
  </div>
</template>

<script>
import AposEditorMixin from 'Modules/@apostrophecms/modal/mixins/AposEditorMixin';
import { detectDocChange } from 'Modules/@apostrophecms/schema/lib/detectChange';
import { klona } from 'klona';
import dayjs from 'dayjs';
import { isEqual } from 'lodash';
import advancedFormat from 'dayjs/plugin/advancedFormat';
import cuid from 'cuid';

dayjs.extend(advancedFormat);

export default {
  mixins: [ AposEditorMixin ],
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
  emits: [ 'saved', 'back', 'modified' ],
  data() {
    return {
      // Primarily use `activeMedia` to support hot-swapping image docs.
      activeMedia: klona(this.media),
      // Unlike `activeMedia` this changes ONLY when a new doc is swapped in.
      // For overall change detection.
      original: klona(this.media),
      lipKey: '',
      triggerValidation: false,
      showReplace: false
    };
  },
  computed: {
    moduleOptions() {
      return window.apos.modules[this.activeMedia.type] || {};
    },
    schema() {
      return (this.moduleOptions.schema || []).filter(field => apos.schema.components.fields[field.type]);
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
    'docFields.data': {
      handler(newData, oldData) {
        this.$nextTick(() => {
          // If either old or new state are an empty object, it's not "modified."
          if (!(Object.keys(oldData).length > 0 && Object.keys(newData).length > 0)) {
            this.$emit('modified', false);
          } else {
            this.$emit('modified', detectDocChange(this.schema, this.original, newData));
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
      this.updateActiveDoc(newVal);
    }
  },
  mounted() {
    this.generateLipKey();
    this.$emit('modified', false);
  },
  methods: {
    updateActiveDoc(newMedia) {
      this.showReplace = false;
      this.activeMedia = klona(newMedia);
      this.original = klona(newMedia);
      this.docFields.data = klona(newMedia);
      this.generateLipKey();
    },
    save() {
      this.triggerValidation = true;
      const route = `${this.moduleOptions.action}/${this.activeMedia._id}`;
      // Repopulate `attachment` since it was removed from the schema.
      this.docFields.data.attachment = this.activeMedia.attachment;

      this.$nextTick(async () => {
        if (this.docFields.hasErrors) {
          await apos.notify('Resolve errors before saving.', {
            type: 'warning',
            icon: 'alert-circle-icon',
            dismiss: true
          });
          return;
        }

        try {
          const doc = await apos.http.put(route, {
            busy: true,
            body: this.docFields.data,
            draft: true
          });
          apos.bus.$emit('content-changed', doc);
          this.original = klona(this.docFields.data);
          this.$emit('modified', false);
          this.$emit('saved');
        } catch (err) {
          await this.handleSaveError(err, {
            fallback: `Error Saving ${this.moduleLabels.label}`
          });
        } finally {
          this.showReplace = false;
        }
      });
    },
    generateLipKey() {
      this.lipKey = cuid();
    },
    cancel() {
      this.showReplace = false;
      this.$emit('back');
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
    margin-bottom: $spacing-double;
  }

  .apos-media-editor__details {
    @include apos-list-reset();
    margin-bottom: $spacing-double;
  }

  .apos-media-editor__detail {
    @include type-base;
    line-height: var(--a-line-tallest);
    color: var(--a-base-4);
  }

  .apos-media-editor__links {
    @include apos-list-reset();
    display: flex;
    margin-bottom: $spacing-triple;

    /deep/ .apos-button--quiet {
      display: block;
    }
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
