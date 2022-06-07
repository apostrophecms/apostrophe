<template>
  <div>
    <label
      class="apos-input-wrapper apos-file-dropzone"
      :class="{
        'apos-file-dropzone--dragover': dragging,
        'apos-is-disabled': disabled || fileOrAttachment
      }"
      @drop.prevent="uploadFile"
      @dragover="dragHandler"
      @dragleave="dragging = false"
    >
      <p class="apos-file-instructions">
        <template v-if="dragging">
          <cloud-upload-icon :size="38" />
        </template>
        <AposSpinner v-else-if="uploading" />
        <template v-else>
          <paperclip-icon :size="14" class="apos-file-icon" />
          {{ messages.primary }}&nbsp;
          <span class="apos-file-highlight" v-if="messages.highlighted">
            {{ messages.highlighted }}
          </span>
        </template>
      </p>
      <input
        ref="uploadField"
        type="file"
        class="apos-sr-only"
        :disabled="disabled || fileOrAttachment"
        @input="uploadFile"
        :accept="allowedExtensions"
      >
    </label>
    <div v-if="fileOrAttachment" class="apos-file-files">
      <AposSlatList
        :value="[fileOrAttachment]"
        @input="update"
        :disabled="attachmentDisabled"
      />
    </div>
  </div>
</template>

<script>
export default {
  props: {
    uploading: {
      type: Boolean,
      default: false
    },
    disabled: {
      type: Boolean,
      default: false
    },
    attachment: {
      type: Object,
      default: null
    },
    allowedExtensions: {
      type: String,
      default: '*'
    },
    readOnly: {
      type: Boolean,
      default: false
    },
    def: {
      type: String,
      default: null
    }
  },
  emits: [ 'upload-file', 'update' ],
  data () {
    return {
      selectedFile: null,
      dragging: false
    };
  },
  computed: {
    fileOrAttachment() {
      return this.selectedFile || this.attachment;
    },
    attachmentDisabled() {
      return this.uploading || this.readOnly || this.disabled;
    },
    messages() {
      const msgs = {
        primary: 'Drop a file here or',
        highlighted: 'click to open the file explorer'
      };
      if (this.disabled) {
        msgs.primary = 'Field is disabled';
        msgs.highlighted = '';
      }
      if (this.fileOrAttachment) {
        msgs.primary = 'Attachment limit reached';
        msgs.highlighted = '';
      }
      return msgs;
    }
  },
  methods: {
    async uploadFile ({ target, dataTransfer }) {
      this.dragging = false;
      const [ file ] = target.files ? target.files : (dataTransfer.files || []);
      this.resetField();

      const extension = file.name.split('.').pop();
      const allowedFile = await this.checkFileGroup(`.${extension}`);

      if (!allowedFile) {
        return;
      }

      this.selectedFile = {
        _id: file.name,
        title: file.name,
        extension,
        _url: URL.createObjectURL(file)
      };

      this.$emit('upload-file', file);
    },
    resetField() {
      this.$refs.uploadField.value = null;
    },
    dragHandler (event) {
      event.preventDefault();

      if (!this.disabled && !this.dragging) {
        this.dragging = true;
      }
    },
    update(items) {
      if (this.selectedFile && this.selectedFile._url) {
        URL.revokeObjectURL(this.selectedFile._url);
      }

      this.selectedFile = null;
      this.$emit('update', items);
    },
    async checkFileGroup(fileExt) {
      const allowedExt = this.allowedExtensions.split(',');
      const allowed = allowedExt.includes(fileExt);

      if (!allowed) {
        await apos.notify('apostrophe:fileTypeNotAccepted', {
          type: 'warning',
          icon: 'alert-circle-icon',
          interpolate: {
            extensions: this.allowedExtensions
          }
        });
      }

      return allowed;
    }
  }
};
</script>
<style scoped lang='scss'>
  .apos-file-dropzone {
    @include apos-button-reset();
    @include type-base;
    display: block;
    margin: 10px 0;
    padding: 20px;
    border: 2px dashed var(--a-base-8);
    border-radius: var(--a-border-radius);
    transition: all 0.2s ease;
    &:hover {
      border-color: var(--a-primary);
      background-color: var(--a-base-10);
    }
    &:active,
    &:focus {
      border: 2px solid var(--a-primary);
    }
    &.apos-is-disabled {
      color: var(--a-base-4);
      background-color: var(--a-base-7);
      border-color: var(--a-base-4);

      &:hover {
        cursor: not-allowed;
      }
    }
  }

  .apos-file-dropzone--dragover {
    border: 2px dashed var(--a-primary);
    background-color: var(--a-base-10);
  }

  .apos-file-instructions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    pointer-events: none;
    // v-html goofiness
    & ::v-deep .apos-file-highlight {
      color: var(--a-primary);
      font-weight: var(--a-weight-bold);
    }
  }

  .apos-file-icon {
    transform: rotate(45deg);
    margin-right: 5px;
  }
</style>
