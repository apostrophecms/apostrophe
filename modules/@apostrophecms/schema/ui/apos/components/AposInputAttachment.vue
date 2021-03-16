<template>
  <AposInputWrapper
    :field="field" :error="effectiveError"
    :uid="uid"
    :display-options="displayOptions"
  >
    <template #body>
      <div class="apos-attachment">
        <label
          class="apos-input-wrapper apos-attachment-dropzone"
          :class="{
            'apos-attachment-dropzone--dragover': dragging,
            'is-disabled': disabled || limitReached
          }"
          :disabled="disabled || limitReached"
          @drop.prevent="uploadMedia"
          @dragover="dragHandler"
          @dragleave="dragging = false"
        >
          <p class="apos-attachment-instructions">
            <template v-if="dragging">
              <cloud-upload-icon :size="38" />
            </template>
            <AposSpinner v-else-if="uploading" />
            <template v-else>
              <paperclip-icon :size="14" class="apos-attachment-icon" />
              {{ messages.primary }}&nbsp;
              <span class="apos-attachment-highlight" v-if="messages.highlighted">
                {{ messages.highlighted }}
              </span>
            </template>
          </p>
          <input
            type="file"
            class="apos-sr-only"
            :disabled="disabled || limitReached"
            @input="uploadMedia"
            :accept="field.accept"
          >
        </label>
        <div v-if="next && next._id" class="apos-attachment-files">
          <AposSlatList
            :value="next ? [ next ] : []"
            @input="updated"
            :disabled="disabled"
          />
        </div>
      </div>
    </template>
  </AposInputWrapper>
</template>

<script>
import AposInputMixin from 'Modules/@apostrophecms/schema/mixins/AposInputMixin.js';
import AposSlatList from 'Modules/@apostrophecms/ui/components/AposSlatList';

export default {
  name: 'AposInputAttachment',
  components: {
    AposSlatList
  },
  mixins: [ AposInputMixin ],
  emits: [ 'upload-started', 'upload-complete' ],
  data () {
    return {
      // Next should consistently be an object or null (an attachment field with
      // no value yet is null, per server side).
      next: (this.value && (typeof this.value.data === 'object'))
        ? this.value.data : (this.field.def || null),
      disabled: false,
      dragging: false,
      uploading: false,
      allowedExtensions: [ '*' ]
    };
  },
  computed: {
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
    },
    limitReached () {
      return !!(this.value.data && this.value.data._id);
    }
  },
  async mounted () {
    this.disabled = this.field.disabled || this.field.readOnly;

    const groups = apos.modules['@apostrophecms/attachment'].fileGroups;
    const groupInfo = groups.find(group => {
      return group.name === this.field.fileGroup;
    });
    if (groupInfo && groupInfo.extensions) {
      this.allowedExtensions = groupInfo.extensions;
    }
  },
  methods: {
    watchNext () {
      this.validateAndEmit();
      this.limitReached = !!this.next;
    },
    updated (items) {
      // NOTE: This is limited to a single item.
      this.next = items.length > 0 ? items[0] : null;
    },
    validate (value) {
      if (this.field.required && !value) {
        return 'required';
      }

      return false;
    },
    async uploadMedia (event) {
      if (!this.disabled || !this.limitReached) {
        try {
          this.dragging = false;
          this.disabled = true;
          this.uploading = true;

          const file = event.target.files ? event.target.files[0] : event.dataTransfer.files[0];

          if (!this.checkFileGroup(file.name)) {
            await apos.notify(`File type was not accepted. Allowed extensions: ${this.allowedExtensions.join(', ')}`, {
              type: 'warning',
              icon: 'alert-circle-icon'
            });

            this.disabled = false;
            this.uploading = false;

            return;
          }

          await apos.notify(`Uploading ${file.name}`, {
            dismiss: true,
            icon: 'cloud-upload-icon'
          });

          const formData = new window.FormData();
          formData.append('file', file);
          const attachment = await apos.http.post('/api/v1/@apostrophecms/attachment/upload', {
            body: formData
          });

          await apos.notify(`Successfully uploaded ${file.name}`, {
            type: 'success',
            dismiss: true,
            icon: 'check-all-icon'
          });

          this.$emit('upload-complete');
          this.value.data = attachment;
        } catch (error) {
          console.error('Error uploading file.', error);
          const msg = error.body && error.body.message ? error.body.message : 'Upload error';
          await apos.notify(msg, {
            type: 'danger',
            icon: 'alert-circle-icon',
            dismiss: true
          });
        } finally {
          this.disabled = false;
          this.uploading = false;
        }
      }
    },
    checkFileGroup(filename) {
      const fileExt = filename.split('.').pop();
      return this.allowedExtensions[0] === '*' ||
        this.allowedExtensions.includes(fileExt);
    },
    dragHandler (event) {
      event.preventDefault();
      if (!this.disabled && !this.dragging) {
        this.dragging = true;
      }
    }
  }
};
</script>

<style lang="scss" scoped>
  .apos-attachment-dropzone {
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
    &.is-disabled {
      color: var(--a-base-4);
      background-color: var(--a-base-7);
      border-color: var(--a-base-4);

      &:hover {
        cursor: not-allowed;
      }
    }
  }

  .apos-attachment-dropzone--dragover {
    border: 2px dashed var(--a-primary);
    background-color: var(--a-base-10);
  }

  .apos-attachment-instructions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    pointer-events: none;
    // v-html goofiness
    & /deep/ .apos-attachment-highlight {
      color: var(--a-primary);
      font-weight: var(--a-weight-bold);
    }
  }

  .apos-attachment-icon {
    transform: rotate(45deg);
    margin-right: 5px;
  }
</style>
