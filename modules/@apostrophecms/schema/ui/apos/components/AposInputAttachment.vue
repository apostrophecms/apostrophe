<template>
  <AposInputWrapper
    :field="field" :error="effectiveError"
    :uid="uid" :modifiers="modifiers"
    :display-options="displayOptions"
  >
    <template #body>
      <div class="apos-attachment">
        <AposFile
          :allowed-extensions="field.accept"
          :uploading="uploading"
          :disabled="disabled || field.readOnly"
          :limit-reached="limitReached"
          :attachment="next"
          :def="field.def"
          @upload-file="uploadMedia"
          @update="updated"
        />
      </div>
    </template>
  </AposInputWrapper>
</template>

<script>
import AposInputMixin from 'Modules/@apostrophecms/schema/mixins/AposInputMixin.js';

export default {
  name: 'AposInputAttachment',
  mixins: [ AposInputMixin ],
  emits: [ 'upload-started', 'upload-complete' ],
  data () {
    return {
      // Next should consistently be an object or null (an attachment field with
      // no value yet is null, per server side).
      next: (this.value && (typeof this.value.data === 'object'))
        ? this.value.data : (this.field.def || null),
      disabled: false,
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
    this.disabled = this.field.readOnly;

    const groups = apos.modules['@apostrophecms/attachment'].fileGroups;
    const groupInfo = groups.find(group => {
      return group.name === this.field.fileGroup;
    });
    if (groupInfo && groupInfo.extensions) {
      this.allowedExtensions = groupInfo.extensions;
    }
  },
  methods: {
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
    async uploadMedia ([ file ]) {
      if (!this.disabled || !this.limitReached) {
        try {
          this.disabled = true;
          this.uploading = true;

          if (!this.checkFileGroup(file.name)) {
            const joined = this.allowedExtensions.join(this.$t('apostrophe:listJoiner'));
            await apos.notify('apostrophe:fileTypeNotAccepted', {
              type: 'warning',
              icon: 'alert-circle-icon',
              interpolate: {
                extensions: joined
              }
            });

            this.disabled = false;
            this.uploading = false;

            return;
          }

          await apos.notify('apostrophe:uploading', {
            dismiss: true,
            icon: 'cloud-upload-icon',
            interpolate: {
              name: file.name
            }
          });

          const formData = new window.FormData();
          formData.append('file', file);
          const attachment = await apos.http.post('/api/v1/@apostrophecms/attachment/upload', {
            body: formData
          });

          await apos.notify('apostrophe:uploaded', {
            type: 'success',
            dismiss: true,
            icon: 'check-all-icon',
            interpolate: {
              name: file.name,
              count: 1
            }
          });

          this.$emit('upload-complete');
          this.value.data = attachment;
        } catch (error) {
          console.error('Error uploading file.', error);
          const msg = error.body && error.body.message ? error.body.message : this.$t('apostrophe:uploadError');
          await apos.notify(msg, {
            type: 'danger',
            icon: 'alert-circle-icon',
            dismiss: true,
            localize: false
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
    &.apos-is-disabled {
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
    & ::v-deep .apos-attachment-highlight {
      color: var(--a-primary);
      font-weight: var(--a-weight-bold);
    }
  }

  .apos-attachment-icon {
    transform: rotate(45deg);
    margin-right: 5px;
  }
</style>
