<template>
  <label
    :class="dropzoneClasses"
    @drop.prevent="uploadMedia"
    @dragover.prevent="dragover = true"
    @dragleave="dragover = false"
  >
    <div class="apos-media-uploader__inner">
      <AposCloudUploadIcon
        class="apos-media-uploader__icon"
      />
      <div class="apos-media-uploader__instructions">
        <p class="apos-media-uploader__primary">
          {{ dragover ? 'Drop’em when you’re ready' : 'Drop new media here' }}
        </p>
        <p
          v-if="!dragover"
          class="apos-media-uploader__secondary"
        >
          Or click to open the file explorer
        </p>
      </div>
    </div>
    <input
      type="file" class="apos-sr-only"
      ref="apos-upload-input"
      @input="uploadMedia"
      multiple="true"
    >
  </label>
</template>

<script>
export default {
  name: 'AposMediaUploader',
  props: {
    action: {
      type: String,
      required: true
    }
  },
  emits: [
    'upload-started',
    'upload-complete',
    'create-placeholder'
  ],
  data() {
    return {
      dragover: false
    };
  },
  computed: {
    dropzoneClasses () {
      return [
        'apos-media-manager-display__cell',
        'apos-media-uploader',
        {
          'is-dragging': this.dragover
        }
      ];
    }
  },
  methods: {
    dragHandler (event) {
      event.preventDefault();
      this.dragging = true;
    },
    async uploadMedia (event) {
      // Set `dragover` in case the media was dropped.
      this.dragover = false;

      this.$emit('upload-started');
      const files = event.dataTransfer ? event.dataTransfer.files : event.target.files;
      const fileCount = files.length;

      const emptyDoc = await apos.http.post(this.action, {
        body: {
          _newInstance: true
        }
      });
      await apos.notify(
        // TODO: i18n
        `Uploading ${fileCount} image${fileCount > 1 ? 's' : ''}`, {
          dismiss: true
        }
      );

      // Send up placeholders
      for (const file of files) {
        this.createPlaceholder(file);
      }

      const imageIds = [];
      // Actually upload the images and send them up once all done.
      for (const file of files) {
        try {
          const img = await this.insertImage(file, emptyDoc);
          imageIds.push(img._id);
        } catch (e) {
          const msg = e.body && e.body.message ? e.body.message : 'Upload error';
          await apos.notify(msg, {
            type: 'danger',
            icon: 'alert-circle-icon',
            dismiss: true
          });
          return;
        }
      }

      // TODO: i18n
      await apos.notify('Upload Successful', {
        type: 'success',
        dismiss: true
      });

      // When complete, refresh the image grid, with the new images at top.
      this.$emit('upload-complete', imageIds);
    },
    createPlaceholder(file) {
      const img = new Image();
      const dimensions = {};
      const objectUrl = window.URL.createObjectURL(file);
      const self = this;

      img.onload = function () {
        dimensions.width = this.width;
        dimensions.height = this.height;
        window.URL.revokeObjectURL(objectUrl);

        self.$emit('create-placeholder', dimensions);
      };
      img.src = objectUrl;
    },
    async insertImage(file, emptyDoc) {
      const formData = new window.FormData();

      formData.append('file', file);

      // Make an async request to upload the image.
      const attachment = await apos.http.post('/api/v1/@apostrophecms/attachment/upload', {
        body: formData
      });

      const imageData = Object.assign(emptyDoc, {
        title: attachment.title,
        attachment
      });

      try {
        const imgPiece = await apos.http.post(this.action, {
          body: imageData
        });

        return imgPiece;
      } catch (error) {
        await this.notifyErrors(error, 'Upload Error');
        return {};
      }
    },
    async notifyErrors(error, fallback) {
      if (error.body && error.body.data && error.body.data.errors) {
        for (const err of error.body.data.errors) {
          await apos.notify(err.message || err.name || fallback, {
            type: 'danger',
            icon: 'alert-circle-icon',
            dismiss: true
          });
        }
      }
    }
  }
};
</script>

<style lang="scss" scoped>
  .apos-media-uploader {
    @include apos-button-reset();
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px dashed var(--a-base-3);
    grid-column: 1 / 3;
    grid-row: 1 / 3;
    @include apos-transition();

    &::after {
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
      @include apos-transition($duration: 0.3s);
    }

    &:hover,
    &:active,
    &:focus,
    &.is-dragging {
      border-width: 0;

      &::after {
        width: 102%;
        height: 102%;
      }
      .apos-media-uploader__icon {
        fill: url(#apos-upload-gradient);
        transform: translateY(-2px);
      }
    }

    &:active,
    &:focus {
      outline: 1px solid var(--a-primary);
    }
  }

  .apos-media-uploader__inner {
    display: flex;
    width: 100%;
    height: 100%;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background-color: var(--a-background-primary);
  }

  .apos-media-uploader__icon {
    width: 57px;
    max-width: 50%;
    height: auto;
    margin-bottom: 5px;
    fill: var(--a-text-primary);
    @include apos-transition($duration: 0.2s);
  }

  .apos-media-uploader__instructions {
    padding: 0 5px;
  }

  .apos-media-uploader__primary,
  .apos-media-uploader__secondary {
    @include apos-p-reset();
    text-align: center;
  }
  .apos-media-uploader__secondary {
    @include type-small;
  }
  .apos-media-uploader__primary {
    @include novella-large;
    max-width: 100px;
    margin: 5px auto 10px;
  }
</style>
