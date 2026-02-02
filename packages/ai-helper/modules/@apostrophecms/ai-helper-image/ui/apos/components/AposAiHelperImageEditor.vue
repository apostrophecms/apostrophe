<template>
  <AposModal
    class="apos-ai-helper-image-editor"
    :modal="modal"
    modal-title="aposAiHelper:generateImage"
    @inactive="modal.active = false"
    @show-modal="modal.showModal = true"
    @esc="close"
    @no-modal="$emit('safe-close')"
  >
    <template #primaryControls>
      <AposButton
        type="default"
        label="apostrophe:close"
        @click="close"
      />
    </template>
    <template #main>
      <AposModalBody>
        <template #bodyMain>
          <div class="apos-ai-helper-form">
            <img
              v-if="image"
              class="apos-ai-helper-image"
              :src="image.url"
            >
            <div
              v-if="image && showVariantInput"
              class="apos-ai-helper-image-editor__variant-input"
            >
              <label class="apos-ai-helper-image-editor__label">
                {{ $t('aposAiHelper:variantPromptLabel') }}
              </label>
              <textarea
                v-model="variantPrompt"
                class="apos-ai-helper-image-editor__textarea"
                :placeholder="$t('aposAiHelper:variantPromptPlaceholder')"
                rows="3"
              />
            </div>
            <div
              v-if="image"
              class="apos-ai-helper-image-buttons"
            >
              <AposButton
                :disabled="image.accepted"
                icon="plus-icon"
                :label="$t('aposAiHelper:select')"
                type="primary"
                @click.prevent="action('save')"
              />
              <AposButton
                v-if="!showVariantInput"
                icon="group-icon"
                :label="$t('aposAiHelper:variations')"
                @click.prevent="showVariantInput = true"
              />
              <AposButton
                v-if="showVariantInput"
                icon="robot-icon"
                type="primary"
                :label="$t('aposAiHelper:generateVariant')"
                :disabled="!variantPrompt.trim()"
                @click="createVariant"
              />
              <AposButton
                icon="delete-icon"
                :label="$t('aposAiHelper:delete')"
                type="danger"
                @click.prevent="action('delete')"
              />
            </div>
            <p v-if="error">
              An error occurred.
            </p>
          </div>
        </template>
      </AposModalBody>
    </template>
  </AposModal>
</template>

<script>
export default {
  props: {
    image: {
      type: Object,
      required: false,
      default: null
    }
  },
  emits: [ 'modal-result', 'safe-close' ],
  data() {
    return {
      modal: {
        active: false,
        type: 'overlay',
        showModal: true
      },
      error: false,
      showVariantInput: false,
      variantPrompt: ''
    };
  },
  mounted() {
    this.modal.active = true;
    if (this.image) {
      const expireMs = new Date(this.image.createdAt).getTime() + 1000 * 60 * 60;
      const nowMs = Date.now();
      const timeout = expireMs - nowMs;
      this.expireTimeout = setTimeout(this.expire, Math.max(timeout, 0));
    }
  },
  unmounted() {
    clearTimeout(this.expireTimeout);
  },
  methods: {
    expire() {
      this.modal.showModal = false;
    },
    close() {
      this.modal.showModal = false;
    },
    action(action) {
      this.modal.showModal = false;
      this.$emit('modal-result', {
        action
      });
    },
    createVariant() {
      if (!this.variantPrompt.trim()) {
        return;
      }
      this.modal.showModal = false;
      this.$emit('modal-result', {
        action: 'variant',
        prompt: this.variantPrompt.trim()
      });
    }
  }
};
</script>

<style lang="scss" scoped>
:deep(.apos-modal__main), :deep(.apos-modal__body-inner), :deep(.apos-modal__body-main) {
  height: 100%;
  min-height: 0;
}
.apos-ai-helper-form {
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 32px;
}
.apos-ai-helper-image {
  object-fit: contain;
  min-height: 0;
}
.apos-ai-helper-image-buttons {
  display: flex;
  flex-direction: row;
  justify-content: center;
  gap: 32px;
}
.apos-ai-helper-image-editor__variant-input {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.apos-ai-helper-image-editor__label {
  font-weight: 600;
}
.apos-ai-helper-image-editor__textarea {
  padding: 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-family: inherit;
  font-size: 14px;
}
</style>
