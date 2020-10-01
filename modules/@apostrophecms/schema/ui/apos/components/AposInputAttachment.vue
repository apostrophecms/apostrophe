<template>
  <AposInputWrapper
    :field="field" :error="error"
    :uid="uid"
  >
    <template #body>
      <div class="apos-attachment">
        <label
          class="apos-input-wrapper apos-attachment-dropzone"
          :class="{ 'apos-attachment-dropzone--dragover': dragging }"
          :disabled="field.disabled"
          @drop.prevent="uploadMedia"
          @dragover="dragHandler"
          @dragleave="dragging = false"
        >
          <p class="apos-attachment-instructions">
            <template v-if="dragging">
              <cloud-upload-icon :size="38"  />
            </template>
            <template v-else>
              <paperclip-icon :size="14" />
              {{ messagePart1 }}
              <span class="apos-attachment-highlight">{{ messagePart2 }}</span>
            </template>
          </p>
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
  data () {
    let messagePart1 = 'Drop a file here or';
    let messagePart2 = 'click to open the file explorer';

    if (this.field.disabled) {
      messagePart1 = 'This field is disabled';
      messagePart2 = '';
    }
    return {
      dragging: false,
      messagePart1,
      messagePart2
    };
  },
  async mounted () {
    if (this.value.data && this.value.data._id) {
      const url = await apos.http.get('/api/v1/@apostrophecms/attachment/url', {
        qs: {
          attachment: this.next
        }
      });
      this.value.data = {
        ...this.value.data,
        url
      };
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
        this.dragging = false;
        this.$emit('upload-started');

        const file = event.target.files ? event.target.files[0] : event.dataTransfer.files[0];
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
    },
    dragHandler (event) {
      event.preventDefault();
      this.dragging = true;
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

  .apos-attachment-dropzone--dragover {
    border: 2px dashed var(--a-primary);
    background-color: var(--a-base-10);
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
