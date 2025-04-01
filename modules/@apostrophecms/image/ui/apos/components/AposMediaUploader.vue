<template>
  <label
    class="apos-media-manager-display__cell apos-media-uploader"
    :class="{'apos-media-uploader--enabled': !disabled}"
    :disabled="disabled ? disabled : null"
    @drop.prevent="uploadMedia"
    @dragover.prevent=""
    @dragenter="incrementDragover"
    @dragleave="decrementDragover"
  >
    <div
      class="apos-media-uploader__inner"
      :class="{'apos-is-dragging': dragover}"
      tabindex="0"
      data-apos-focus-priority
      @keydown="onUploadDragAndDropKeyDown"
    >
      <AposCloudUploadIcon
        class="apos-media-uploader__icon"
      />
      <div class="apos-media-uploader__instructions">
        <p class="apos-media-uploader__primary">
          {{ $t(dragover ? 'apostrophe:mediaUploadViaDrop' : 'apostrophe:dropMedia') }}
        </p>
        <p
          v-if="!dragover"
          class="apos-media-uploader__secondary"
        >
          {{ $t('apostrophe:mediaUploadViaExplorer') }}
        </p>
      </div>
    </div>
    <input
      ref="upload"
      type="file"
      class="apos-sr-only"
      :accept="accept"
      multiple="true"
      :disabled="disabled"
      tabindex="-1"
      @input="uploadMedia"
    >
  </label>
</template>

<script>
import { createId } from '@paralleldrive/cuid2';

export default {
  name: 'AposMediaUploader',
  props: {
    action: {
      type: String,
      required: true
    },
    disabled: {
      type: Boolean,
      default: false
    },
    accept: {
      type: String,
      required: false,
      default: null
    }
  },
  emits: [
    'upload-started',
    'upload-complete',
    'create-placeholder'
  ],
  data() {
    return {
      dragover: false,
      dragoverCount: 0
    };
  },
  computed: {

  },
  mounted() {
    apos.bus.$on('command-menu-manager-create-new', this.create);
  },
  unmounted() {
    apos.bus.$off('command-menu-manager-create-new', this.create);
  },
  methods: {
    create() {
      if (!this.disabled) {
        this.$refs.upload.click();
      }
    },
    incrementDragover() {
      this.dragoverCount++;
      this.dragover = this.dragoverCount > 0;
    },
    decrementDragover() {
      this.dragoverCount--;
      this.dragover = this.dragoverCount > 0;
    },
    dragHandler (event) {
      if (this.disabled) {
        return;
      }
      event.preventDefault();
      this.dragging = true;
    },
    async uploadMedia (event) {
      try {
        apos.bus.$emit('busy', {
          name: 'busy',
          active: true
        });

        if (this.disabled) {
          return;
        }
        // Set `dragover` in case the media was dropped.
        this.dragover = false;

        this.$emit('upload-started');
        const files = event.dataTransfer ? event.dataTransfer.files : event.target.files;
        const fileCount = files.length;

        const emptyDoc = await apos.http.post(this.action, {
          busy: true,
          body: {
            _newInstance: true
          },
          draft: true
        });

        // Send up placeholders
        [ ...files ].forEach(() => this.createPlaceholder(emptyDoc));

        const images = [];
        // Actually upload the images and send them up once all done.
        for (const file of files) {
          try {
            const img = await this.insertImage(file, { ...emptyDoc });
            if (img?._id) {
              images.push(img);
            }
          } catch (e) {
            const msg = e.body && e.body.message ? e.body.message : this.$t('apostrophe:uploadError');
            await apos.notify(msg, {
              type: 'danger',
              icon: 'alert-circle-icon',
              dismiss: true,
              localize: false
            });
            return;
          }
        }

        await apos.notify('apostrophe:uploaded', {
          type: 'success',
          dismiss: true,
          interpolate: {
            count: fileCount
          }
        });

        // When complete, refresh the image grid, with the new images at top.
        this.$emit('upload-complete', images);
      } finally {
        apos.bus.$emit('busy', {
          name: 'busy',
          active: false
        });
        this.$refs.upload.value = '';
      }
    },
    createPlaceholder(piece) {
      this.$emit('create-placeholder', {
        ...piece,
        __placeholder: createId()
      });
    },
    async insertImage(file, emptyDoc) {
      const formData = new window.FormData();

      formData.append('file', file);

      // Make an async request to upload the image.
      const attachment = await apos.http.post('/api/v1/@apostrophecms/attachment/upload', {
        busy: true,
        body: formData
      });

      const imageData = Object.assign(emptyDoc, {
        title: attachment.title,
        attachment
      });

      try {
        const imgPiece = await apos.http.post(this.action, {
          busy: true,
          body: imageData,
          draft: true
        });

        return imgPiece;
      } catch (error) {
        await this.notifyErrors(error, this.$t('apostrophe:uploadError'));
        return {};
      }
    },
    async notifyErrors(error, fallback) {
      if (error.body && error.body.data && error.body.data.errors) {
        for (const err of error.body.data.errors) {
          await apos.notify(err.message || err.name || fallback, {
            type: 'danger',
            icon: 'alert-circle-icon',
            dismiss: true,
            localize: false
          });
        }
      }
    },
    // Trigger the file input click (via `this.create`) when pressing Enter or Space
    // of the drag&drop area, which is made focusable unlike the input file.
    onUploadDragAndDropKeyDown(e) {
      const isEnterPressed = e.key === 'Enter' || e.code === 'Enter' || e.code === 'NumpadEnter';
      const isSpaceBarPressed = e.keyCode === 32 || e.code === 'Space';

      if (isSpaceBarPressed) {
        e.preventDefault();
      }

      if (isEnterPressed || isSpaceBarPressed) {
        this.create();
      }
    }
  }
};
</script>

<style lang="scss" scoped>
  .apos-media-uploader {
    @include apos-button-reset();
    @include apos-transition();

    & {
      display: flex;
      box-sizing: border-box;
      align-items: center;
      justify-content: center;
      border: 2px dashed var(--a-base-3);
      color: inherit;
      grid-column: 1 / 3;
      grid-row: 1 / 3;
    }
  }

  .apos-media-uploader--enabled .apos-media-uploader__inner {
    &::after {
      @include apos-transition($duration: 0.3s);

      & {
        z-index: $z-index-under;
        position: absolute;
        content: '';
        width: 90%;
        height: 90%;
        background-image:
          linear-gradient(to right, rgba($brand-magenta, 0.3), rgba($brand-blue, 0.3)),
          linear-gradient(to right, rgba($brand-gold, 0.3), rgba($brand-magenta, 0.3));
        background-size:
          100% 60%,
          100% 60%;
        background-position:
          5% -5%,
          5% 100%;
        background-repeat: no-repeat;
        filter: blur(10px);
      }
    }

    &:hover,
    &:active,
    &:focus,
    &.apos-is-dragging {
      outline: 2px dashed var(--a-primary);

      &::after {
        width: 102%;
        height: 102%;
      }

      .apos-media-uploader__icon {
        fill: url("#apos-upload-gradient");
        transform: translateY(-2px);
      }
    }
  }

  .apos-media-uploader__inner {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    background-color: var(--a-background-primary);
  }

  .apos-media-uploader__icon {
    @include apos-transition($duration: 0.2s);

    & {
      width: 57px;
      max-width: 50%;
      height: auto;
      margin-bottom: 5px;
      fill: var(--a-text-primary);
    }
  }

  .apos-media-uploader__instructions {
    padding: 0 5px;
  }

  .apos-media-uploader__primary,
  .apos-media-uploader__secondary {
    @include apos-p-reset();

    & {
      text-align: center;
    }
  }

  .apos-media-uploader__secondary {
    @include type-small;
  }

  .apos-media-uploader__primary {
    @include type-large;

    & {
      max-width: 100px;
      margin: 5px auto 10px;
    }
  }
</style>
