<template>
  <AposModal
    class="apos-ai-helper-media-variant"
    :modal="modal"
    modal-title="aposAiHelper:generateVariant"
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
          <div class="apos-ai-helper-media-variant__content">
            <div
              v-if="loading"
              class="apos-ai-helper-media-variant__loading"
            >
              <AposSpinner />
            </div>

            <div
              v-else-if="activeSourceImage"
              class="apos-ai-helper-media-variant__source"
            >
              <label class="apos-ai-helper-media-variant__label">
                {{ $t('aposAiHelper:sourceImage') }}
              </label>
              <div class="apos-ai-helper-media-variant__source-image">
                <img
                  v-if="activeSourceImage.attachment && activeSourceImage.attachment._urls"
                  :src="activeSourceImage.attachment._urls['one-third']"
                  :alt="activeSourceImage.title"
                >
              </div>
            </div>

            <div class="apos-ai-helper-media-variant__prompt-section">
              <label class="apos-ai-helper-media-variant__label">
                {{ $t('aposAiHelper:variantPromptLabel') }}
              </label>
              <textarea
                v-model="prompt"
                class="apos-ai-helper-media-variant__textarea"
                :placeholder="$t('aposAiHelper:variantPromptPlaceholder')"
                rows="3"
              />
            </div>

            <div class="apos-ai-helper-media-variant__actions">
              <AposButton
                icon="robot-icon"
                type="primary"
                :label="$t('aposAiHelper:generateVariant')"
                :disabled="generating || loading || !activeSourceImage"
                @click="generate"
              />
            </div>

            <p
              v-if="error"
              class="apos-ai-helper-media-variant__error"
            >
              {{ $t('aposAiHelper:generationFailed') }}
            </p>

            <div
              v-if="images.length"
              class="apos-ai-helper-media-variant__results"
            >
              <label class="apos-ai-helper-media-variant__label">
                {{ $t('aposAiHelper:variations') }}
              </label>
              <div class="apos-ai-helper-media-variant__images">
                <button
                  v-for="image in images"
                  :key="image._id"
                  class="apos-ai-helper-media-variant__image"
                  @click.prevent="edit(image)"
                >
                  <img :src="image.url">
                </button>
              </div>
            </div>
          </div>
        </template>
      </AposModalBody>
    </template>
  </AposModal>
</template>

<script>
export default {
  props: {
    // Direct source image (for sidebar button usage)
    sourceImage: {
      type: Object,
      default: null
    },
    // Checked items from batch operation (array of IDs)
    checked: {
      type: Array,
      default: () => []
    },
    // Module name from batch operation
    moduleName: {
      type: String,
      default: null
    }
  },
  emits: [ 'modal-result', 'safe-close' ],
  data() {
    return {
      modal: {
        active: false,
        type: 'slide',
        origin: 'right',
        showModal: false,
        width: 'two-thirds'
      },
      prompt: '',
      images: [],
      error: false,
      generating: false,
      loading: false,
      // The actual image object to use
      activeSourceImage: null
    };
  },
  async mounted() {
    this.modal.active = true;
    await this.initSourceImage();
  },
  methods: {
    close() {
      this.modal.showModal = false;
    },
    async initSourceImage() {
      // If sourceImage is directly provided, use it
      if (this.sourceImage) {
        this.activeSourceImage = this.sourceImage;
        return;
      }

      // If checked array is provided (from batch operation), fetch the first image
      if (this.checked && this.checked.length > 0) {
        this.loading = true;
        try {
          const imageId = this.checked[0];
          const response = await apos.http.get(`${apos.image.action}/${imageId}`, {
            busy: true
          });
          this.activeSourceImage = response;
        } catch (e) {
          this.error = true;
        } finally {
          this.loading = false;
        }
      }
    },
    async generate() {
      if (!this.activeSourceImage) {
        return;
      }
      this.error = false;
      this.generating = true;
      try {
        const result = await apos.http.post(`${apos.image.action}/ai-helper/media-variant`, {
          body: {
            mediaImageId: this.activeSourceImage._id,
            prompt: this.prompt
          },
          busy: true
        });
        this.images = [ ...result.images, ...this.images ];
      } catch (e) {
        this.error = true;
      } finally {
        this.generating = false;
      }
    },
    async edit(image) {
      const result = await apos.modal.execute('AposAiHelperImageEditor', {
        image
      });
      const action = result?.action;
      if (action) {
        if (action === 'save') {
          await this.save(image);
        } else if (action === 'variant') {
          await this.generateFromVariant(image, result.prompt);
        } else if (action === 'delete') {
          await this.remove(image);
        }
      }
    },
    async generateFromVariant(variantOf, variantPrompt) {
      this.error = false;
      this.generating = true;
      try {
        const result = await apos.http.post(`${apos.image.action}/ai-helper`, {
          body: {
            prompt: variantPrompt || variantOf.prompt,
            variantOf: variantOf._id
          },
          busy: true
        });
        this.images = [ ...result.images, ...this.images ];
      } catch (e) {
        this.error = true;
      } finally {
        this.generating = false;
      }
    },
    async save({ _id }) {
      try {
        const updated = await apos.http.patch(`${apos.image.action}/ai-helper/${_id}`, {
          body: {
            accepted: 1
          },
          busy: true
        });
        const image = updated._image;
        this.$emit('modal-result', image);
        this.modal.showModal = false;
        apos.bus.$emit('content-changed', {
          doc: image,
          action: 'insert',
          select: true
        });
      } catch (e) {
        this.error = true;
      }
    },
    async remove({ _id }) {
      this.images = this.images.filter(image => image._id !== _id);
      await apos.http.delete(`${apos.image.action}/ai-helper/${_id}`, {
        busy: true
      });
    }
  }
};
</script>

<style lang="scss" scoped>
.apos-ai-helper-media-variant__content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.apos-ai-helper-media-variant__loading {
  display: flex;
  justify-content: center;
  padding: 40px;
}

.apos-ai-helper-media-variant__label {
  display: block;
  margin-bottom: 8px;
  font-weight: 600;
}

.apos-ai-helper-media-variant__source-image {
  display: flex;
  align-items: center;
  justify-content: center;
  max-width: 300px;
  max-height: 200px;
  border: 1px solid var(--a-base-7);
  border-radius: 4px;
  overflow: hidden;

  img {
    max-width: 100%;
    max-height: 200px;
    object-fit: contain;
  }
}

.apos-ai-helper-media-variant__textarea {
  width: 100%;
  padding: 8px;
  border: 1px solid var(--a-base-7);
  border-radius: 4px;
  font-family: inherit;
  font-size: 14px;
  resize: vertical;
}

.apos-ai-helper-media-variant__actions {
  display: flex;
  gap: 16px;
}

.apos-ai-helper-media-variant__error {
  color: var(--a-danger);
}

.apos-ai-helper-media-variant__images {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.apos-ai-helper-media-variant__image {
  border: none;
  padding: 0;
  background: none;
  cursor: pointer;
  border-radius: 4px;
  overflow: hidden;

  img {
    width: 100%;
    height: 100%;
    aspect-ratio: 1;
    object-fit: contain;
  }

  &:hover {
    opacity: 0.8;
  }
}
</style>
