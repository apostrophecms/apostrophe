<template>
  <div>
    <label
      class="apos-input-wrapper apos-file-dropzone"
      :class="{
        'apos-file-dropzone--dragover': dragging,
        'apos-is-disabled': disabled || limitReached
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
        type="file"
        class="apos-sr-only"
        :disabled="disabled || limitReached"
        @input="uploadFile"
        :accept="allowedExtensions"
      >
    </label>
    <div v-if="filesOrAttachment.length" class="apos-file-files">
      <AposSlatList
        :value="filesOrAttachment"
        @input="update"
        :disabled="readOnly"
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
    limit: {
      type: Number,
      default: 1
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
      selectedFiles: [],
      dragging: false
    };
  },
  computed: {
    limitReached () {
      return this.filesOrAttachment.length >= this.limit;
    },
    filesOrAttachment () {
      if (!this.selectedFiles.length && !this.attachment) {
        return [];
      }

      return this.selectedFiles.length
        ? this.selectedFiles
        : [ this.attachment ];
    },
    messages () {
      const msgs = {
        primary: 'Drop a file here or',
        highlighted: 'click to open the file explorer'
      };
      if (this.disabled) {
        msgs.primary = 'Field is disabled';
        msgs.highlighted = '';
      }
      if (this.limitReached) {
        msgs.primary = 'Attachment limit reached';
        msgs.highlighted = '';
      }
      return msgs;
    }
  },
  methods: {
    uploadFile ({ target, dataTransfer }) {
      this.dragging = false;

      const files = target.files ? target.files : (dataTransfer.files || []);

      const filteredFiles = Array.from(files).filter((_, i) => i + 1 <= this.limit);

      const extensionRegex = /(?:\.([^.]+))?$/;

      this.selectedFiles = filteredFiles.map((file) => {
        const [ _, extension ] = extensionRegex.exec((file.name));

        return {
          _id: file.name,
          title: file.name,
          extension,
          _url: URL.createObjectURL(file)
        };
      });

      this.$emit('upload-file', files);
    },
    dragHandler (event) {
      event.preventDefault();

      if (!this.disabled && !this.dragging) {
        this.dragging = true;
      }
    },
    update(items) {
      this.selectedFiles.forEach(({ _url }) => {
        if (_url) {
          URL.revokeObjectURL(_url);
        }
      });
      this.selectedFiles = items || [];
      this.$emit('update', items);
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
