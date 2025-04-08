<template>
  <div
    class="apos-media-editor"
    :class="{
      'apos-is-replacing': showReplace
    }"
  >
    <div
      v-if="activeMedia"
      class="apos-media-editor__inner"
    >
      <div class="apos-media-editor__thumb-wrapper">
        <img
          v-if="activeMedia.attachment && activeMedia.attachment._urls"
          class="apos-media-editor__thumb"
          :src="activeMedia.attachment._urls[restoreOnly ? 'one-sixth' : 'one-third']"
          :alt="activeMedia.description"
        >
      </div>
      <ul class="apos-media-editor__details">
        <li
          v-if="createdDate"
          class="apos-media-editor__detail"
        >
          {{ $t('apostrophe:mediaCreatedDate', { createdDate }) }}
        </li>
        <li
          v-if="fileSize"
          class="apos-media-editor__detail"
        >
          {{ $t('apostrophe:mediaFileSize', { fileSize }) }}
        </li>
        <li
          v-if="activeMedia.attachment && activeMedia.attachment.width"
          class="apos-media-editor__detail"
        >
          {{
            $t('apostrophe:mediaDimensions', {
              width: activeMedia.attachment.width,
              height: activeMedia.attachment.height
            })
          }}
        </li>
      </ul>
      <ul class="apos-media-editor__links">
        <li
          class="apos-media-editor__link"
          aria-hidden="true"
        >
          <AposButton
            type="quiet"
            label="apostrophe:replace"
            :disabled="isArchived"
            @click="showReplace = true"
          />
        </li>
        <li
          v-if="activeMedia.attachment && activeMedia.attachment._urls"
          class="apos-media-editor__link"
        >
          <AposButton
            type="quiet"
            label="apostrophe:view"
            :disabled="isArchived"
            @click="viewMedia"
          />
        </li>
        <li
          v-if="activeMedia.attachment && activeMedia.attachment._urls"
          class="apos-media-editor__link"
        >
          <AposButton
            type="quiet"
            label="apostrophe:download"
            :href="!isArchived ? activeMedia.attachment._urls.original : null"
            :disabled="isArchived"
            download
          />
        </li>
      </ul>
      <AposSchema
        v-if="docFields.data.title !== undefined"
        ref="schema"
        v-model="docFields"
        :schema="schema"
        :modifiers="['small', 'inverted']"
        :trigger-validation="triggerValidation"
        :doc-id="docFields.data._id"
        :following-values="followingValues()"
        :server-errors="serverErrors"
        @validate="triggerValidate"
        @reset="$emit('modified', false)"
      />
    </div>
    <AposModalLip :refresh="lipKey">
      <div
        class="apos-media-editor__lip"
      >
        <AposContextMenu
          v-if="!restoreOnly"
          :button="{
            label: 'apostrophe:moreOperations',
            iconOnly: true,
            icon: 'dots-vertical-icon',
            type: 'subtle',
            modifiers: [ 'small', 'no-motion' ]
          }"
          :menu="moreMenu"
          menu-placement="top-end"
          @item-clicked="moreMenuHandler"
        />
        <AposButton
          class="apos-media-editor__save"
          :disabled="docFields.hasErrors"
          :label="restoreOnly ? 'apostrophe:restore' : 'apostrophe:save'"
          type="primary"
          @click="save"
        />
      </div>
    </AposModalLip>
  </div>
</template>

<script>
import AposEditorMixin from 'Modules/@apostrophecms/modal/mixins/AposEditorMixin';
import AposAdvisoryLockMixin from 'Modules/@apostrophecms/ui/mixins/AposAdvisoryLockMixin';
import AposModifiedMixin from 'Modules/@apostrophecms/ui/mixins/AposModifiedMixin';
import { detectDocChange } from 'Modules/@apostrophecms/schema/lib/detectChange';
import { klona } from 'klona';
import dayjs from 'dayjs';
import { isEqual } from 'lodash';
import advancedFormat from 'dayjs/plugin/advancedFormat';
import { createId } from '@paralleldrive/cuid2';

dayjs.extend(advancedFormat);

export default {
  mixins: [ AposEditorMixin, AposAdvisoryLockMixin, AposModifiedMixin ],
  props: {
    media: {
      type: Object,
      default() {
        return {};
      }
    },
    isModified: {
      type: Boolean,
      default: false
    },
    moduleLabels: {
      type: Object,
      required: true
    }
  },
  emits: [ 'back', 'modified' ],
  data() {
    return {
      // Primarily use `activeMedia` to support hot-swapping image docs.
      activeMedia: klona(this.media),
      restoreOnly: this.media && this.media.archived,
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
    canLocalize() {
      return this.moduleOptions.canLocalize && this.activeMedia._id;
    },
    moreMenu() {
      const menu = [ {
        label: 'apostrophe:discardChanges',
        action: 'cancel'
      } ];
      if (this.canLocalize) {
        menu.push({
          label: 'apostrophe:localize',
          action: 'localize'
        });
      }
      if (this.activeMedia._id && this.activeMedia._delete && !this.restoreOnly) {
        menu.push({
          label: 'apostrophe:archiveImage',
          action: 'archive',
          modifiers: [ 'danger' ]
        });
      }
      return menu;
    },
    fileSize() {
      if (
        !this.activeMedia.attachment || !this.activeMedia.attachment.length
      ) {
        return '';
      }
      const size = this.activeMedia.attachment.length;
      const formatter = new Intl.NumberFormat(apos.locale, {
        maximumFractionDigits: 2
      });
      if (size >= 1000000) {
        const formatted = formatter.format(size / 1000000);
        return this.$t('apostrophe:mediaMB', {
          size: formatted
        });
      } else {
        const formatted = formatter.format(size / 1000);
        return this.$t('apostrophe:mediaKB', {
          size: formatted
        });
      }
    },
    createdDate() {
      if (!this.activeMedia.attachment || !this.activeMedia.attachment.createdAt) {
        return '';
      }
      return dayjs(this.activeMedia.attachment.createdAt).format(this.$t('apostrophe:dayjsMediaCreatedDateFormat'));
    },
    isArchived() {
      // ?. necessary to avoid reference to null due to
      // race condition when toggling selection off
      return this.media?.archived;
    }
  },
  watch: {
    'docFields.data': {
      deep: true,
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
    moreMenuHandler(action) {
      this[action]();
    },
    async updateActiveDoc(newMedia) {
      newMedia = newMedia || {};
      this.showReplace = false;
      this.activeMedia = klona(newMedia);
      this.restoreOnly = !!this.activeMedia.archived;
      this.original = klona(newMedia);
      this.docFields.data = klona(newMedia);
      this.generateLipKey();
      await this.unlock();
      // Distinguish between an actual doc and an empty placeholder
      if (newMedia._id) {
        if (!await this.lock(`${this.moduleOptions.action}/${newMedia._id}`)) {
          this.lockNotAvailable();
        }
      }
    },
    async archive() {
      if (!await apos.confirm({
        heading: 'apostrophe:areYouSure',
        description: 'apostrophe:willMoveImageToArchive'
      })) {
        return;
      }
      const route = `${this.moduleOptions.action}/${this.activeMedia._id}`;
      const patched = await apos.http.patch(route, {
        busy: true,
        body: {
          archived: true
        },
        draft: true
        // Autopublish will take care of the published side
      });
      apos.bus.$emit('content-changed', {
        doc: patched,
        action: 'archive'
      });
      await this.cancel();
    },
    async save() {
      this.triggerValidation = true;
      const route = `${this.moduleOptions.action}/${this.activeMedia._id}`;
      // Repopulate `attachment` since it was removed from the schema.
      this.docFields.data.attachment = this.activeMedia.attachment;

      await this.$nextTick();

      if (this.docFields.hasErrors) {
        this.triggerValidation = false;
        await apos.notify('apostrophe:resolveErrorsBeforeSaving', {
          type: 'warning',
          icon: 'alert-circle-icon',
          dismiss: true
        });
        return;
      }

      let body = this.docFields.data;
      this.addLockToRequest(body);
      try {
        const requestMethod = this.restoreOnly ? apos.http.patch : apos.http.put;
        if (this.restoreOnly) {
          body = {
            archived: false
          };
        }
        const doc = await requestMethod(route, {
          busy: true,
          body,
          draft: true
        });
        apos.bus.$emit('content-changed', {
          doc,
          action: this.restoreOnly ? 'restore' : 'update'
        });
        this.original = klona(this.docFields.data);
      } catch (e) {
        if (this.isLockedError(e)) {
          await this.showLockedError(e);
          this.lockNotAvailable();
        } else {
          const errorMessage = this.restoreOnly
            ? this.$t('apostrophe:mediaManagerErrorRestoring')
            : this.$t('apostrophe:mediaManagerErrorSaving');

          await this.handleSaveError(e, {
            fallback: `${errorMessage} ${this.moduleLabels.singular}`
          });
        }
      } finally {
        this.showReplace = false;

      }
    },
    generateLipKey() {
      this.lipKey = createId();
    },
    cancel() {
      this.showReplace = false;
      this.$emit('back');
    },
    lockNotAvailable() {
      this.$emit('modified', false);
      this.cancel();
    },
    updateActiveAttachment(attachment) {
      this.activeMedia.attachment = attachment;
    },
    viewMedia () {
      window.open(this.activeMedia.attachment._urls.original, '_blank');
    },
    async localize(media) {
      // If there are changes warn the user before discarding them before
      // the localize operation
      if (this.isModified) {
        if (!await this.confirmAndCancel()) {
          return;
        }

        await this.cancel();
        this.updateActiveDoc(this.activeMedia);
      }
      apos.bus.$emit('admin-menu-click', {
        itemName: '@apostrophecms/i18n:localize',
        props: {
          doc: this.activeMedia
        }
      });
    },
    async close() {
      await this.cancel();
    }
  }
};
</script>

<style lang="scss" scoped>
  .apos-media-editor {
    position: relative;
    height: 100%;
    padding: 20px;

    &__inner {
      padding-bottom: 44px;
    }
  }

  .apos-media-editor__thumb-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 180px;
    margin-bottom: 20px;
    border: 1px solid var(--a-base-7);
  }

  .apos-media-editor__thumb {
    max-width: 100%;
    max-height: 100%;
  }

  .apos-media-editor :deep(.apos-field) {
    margin-bottom: $spacing-double;
  }

  .apos-media-editor__details {
    @include apos-list-reset();

    & {
      margin-bottom: $spacing-double;
    }
  }

  .apos-media-editor__detail {
    @include type-base;

    & {
      line-height: var(--a-line-tallest);
      color: var(--a-base-4);
    }
  }

  .apos-media-editor__links {
    @include apos-list-reset();

    & {
      display: flex;
      margin-bottom: $spacing-triple;
    }

    :deep(.apos-button--quiet) {
      display: inline;
    }
  }

  .apos-media-editor__link {
    display: inline-block;

    & + & {
      margin-left: 20px;
    }
  }

  :deep([data-apos-field='attachment']) {
    .apos-media-editor:not(.apos-is-replacing) & {
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
    justify-content: flex-end;
    line-height: var(--a-line-base);

    & > .apos-context-menu, & > .apos-button__wrapper {
      margin-left: 7.5px;
    }
  }
</style>
