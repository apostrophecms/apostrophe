<template>
  <AposInputWrapper
    :field="field" :error="error"
    :uid="uid"
  >
    <template #body>
      <div class="apos-attachment">
        <label :disabled="disabled" class="apos-input-wrapper apos-attachment-dropzone">
          <p class="apos-attachment-instructions" v-html="message" />
          <input
            type="file"
            class="apos-sr-only"
            @input="uploadMedia"
          >
        </label>
        <div v-if="next" class="apos-attachment-files">
          <AposSlatList
            :initial-items="[ next ]"
            :removable="false"
            @update="updated"
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
  computed: {
    limitReached () {
      return this.next.length >= this.field.max;
    },
    message () {
      let message = '<paperclip-icon :size="14" /> Drop a file here or <span class="apos-attachment-highlight">click to open the file explorer</span>';

      if (this.field.disabled) {
        message = 'This field is disabled';
      }

      // limit reached should be a more specific form of disabled and go after it
      if (this.limitReached) {
        message = 'Attachment Limit Reached';
      }

      return message;
    },
    disabled () {
      return (this.limitReached || this.field.disabled);
    }
  },
  methods: {
    updated (items) {
      this.next = items;
    },
    validate (value) {
      if (this.field.required && !value) {
        return 'required';
      }

      return false;
    },
    async uploadMedia (event) {
      try {
        this.$emit('upload-started');

        const file = event.target.files[0];
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
      }
    }
  }
};
</script>

<style lang="scss" scoped>
  .apos-attachment-dropzone {
    @include apos-button-reset();
    display: block;
    width: 100%;
    margin: 10px 0;
    padding: 20px;
    border: 2px dashed var(--a-base-8);
    font-size: map-get($font-sizes, default);
    transition: all 0.2s ease;
    &:not([disabled]):hover {
      border: 2px dashed var(--a-primary);
      background-color: var(--a-base-10);
    }
    &:active, &:focus {
      border: 2px solid var(--a-primary);
    }
    &[disabled] {
      color: var(--a-base-4);
      &:hover {
        cursor: not-allowed;
      }
    }
  }

  .apos-attachment-instructions {
    text-align: center;
    // v-html goofiness
    & /deep/ .apos-attachment-highlight {
      color: var(--a-primary);
      font-weight: 700;
    }
  }

</style>
