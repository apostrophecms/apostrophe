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
        <li class="apos-media-manager-editor__detail" v-if="createdDate">
          Uploaded: {{ createdDate }}
        </li>
        <li
          class="apos-media-manager-editor__detail"
          v-if="media.attachment && media.attachment.length && media.attachment.length.size"
        >
          File Size: {{ fileSize }}
        </li>
        <li
          class="apos-media-manager-editor__detail"
          v-if="media.attachment && media.attachment.width"
        >
          Dimensions: {{ media.attachment.width }} 𝗑
          {{ media.attachment.height }}
        </li>
      </ul>
      <AposSchema
        v-if="doc.data.title"
        :schema="schema"
        v-model="doc"
        :modifiers="['small', 'inverted']"
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
          label="Save" type="primary"
        />
      </div>
    </AposModalLip>
  </div>
</template>

<script>
import AposHelpers from 'Modules/@apostrophecms/ui/mixins/AposHelpersMixin';
import klona from 'klona';
import dayjs from 'dayjs';
import advancedFormat from 'dayjs/plugin/advancedFormat';
dayjs.extend(advancedFormat);

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
      published: {
        field: {
          required: false,
          name: 'published',
          type: 'radio',
          label: 'Published',
          toggle: {
            true: 'Published',
            false: 'Unpublished'
          }
        },
        status: {},
        value: {
          data: true
        }
      },
      lipKey: ''
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
    },
    fileSize() {
      if (
        !this.media.attachment || !this.media.attachment.length ||
        !this.media.attachment.length.size
      ) {
        return '';
      }

      const size = this.media.attachment.length.size;

      if (size >= 1000000) {
        return `${(size / 1000000).toFixed(2)}MB`;
      } else {
        return `${Math.round(size / 1000)}KB`;
      }
    },
    createdDate() {
      if (!this.media.attachment || !this.media.attachment.createdAt) {
        return '';
      }
      return dayjs(this.media.attachment.createdAt).format('MMM Do, YYYY');
    }
  },
  watch: {
    media(newVal) {
      this.doc.data = klona(newVal);
      this.generateLipKey();
    }
  },
  mounted() {
    this.generateLipKey();
  },
  methods: {
    async save() {
      apos.bus.$emit('busy', true);
      const route = `${this.moduleOptions.action}/${this.media._id}`;
      // Repopulate `attachment` since it was removed from the schema.
      this.doc.data.attachment = this.media.attachment;

      try {
        await apos.http.put(route, {
          busy: true,
          body: this.doc.data
        });

        await apos.notify(`${this.moduleLabels.label} Saved`, {
          type: 'success',
          dismiss: true
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
