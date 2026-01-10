<template>
  <AposModal
    class="apos-ai-helper-image-manager"
    :modal="modal"
    modal-title="aposAiHelper:generateImage"
    @inactive="modal.active = false"
    @show-modal="modal.showModal = true"
    @esc="close"
    @no-modal="$emit('safe-close')"
  >
    <template #main>
      <AposModalBody>
        <template #bodyMain>
          <form class="apos-ai-helper-form">
            <textarea
              v-model="prompt"
              :placeholder="$t('aposAiHelper:imagePlaceholderText')"
            />
            <AposButton
              :disabled="!prompt.length"
              :label="$t('aposAiHelper:generateImage')"
              @click.prevent="generate({})"
            />
            <p v-if="error">
              An error occurred.
            </p>
            <div class="apos-ai-helper-images">
              <button
                v-for="image in images"
                :key="image._id"
                class="apos-ai-helper-image"
                @click.prevent="edit(image)"
              >
                <img
                  :src="image.url"
                >
              </button>
            </div>
          </form>
        </template>
      </AposModalBody>
    </template>
  </AposModal>
</template>

<script>
export default {
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
      error: false,
      prompt: '',
      images: []
    };
  },
  async mounted() {
    this.modal.active = true;
    // TODO: Error handling
    this.images = (await apos.http.get(`${apos.image.action}/ai-helper`, { busy: true }))
      .images;
    this.expireInterval = setInterval(this.expire, 1000 * 60);
  },
  unmounted() {
    clearInterval(this.expireInterval);
  },
  methods: {
    expire() {
      const expired = new Date(Date.now() - 1000 * 60 * 60).toISOString();
      if (this.images.some(image => image.createdAt <= expired)) {
        this.images = this.images.filter(image => image.createdAt > expired);
      }
    },
    close() {
      this.modal.showModal = false;
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
          await this.generate({
            variantOf: image,
            variantPrompt: result.prompt
          });
        } else if (action === 'delete') {
          await this.remove(image);
        } else {
          throw new Error(`Unimplemented action: ${action}`);
        }
      }
    },
    async generate({ variantOf, variantPrompt }) {
      this.error = false;
      try {
        const result = await apos.http.post(`${apos.image.action}/ai-helper`, {
          body: {
            prompt: variantPrompt || variantOf?.prompt || this.prompt,
            variantOf: variantOf?._id
          },
          busy: true
        });
        this.images = [ ...result.images, ...this.images ];
        this.$el.querySelector('[data-apos-modal-inner]').scrollTo(0, 0);
      } catch (e) {
        this.error = true;
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
.apos-ai-helper-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.apos-ai-helper-images {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.apos-ai-helper-image img {
  width: 100%;
  height: 100%;
  aspect-ratio: 1;
  object-fit: contain;
}
textarea {
  height: 4em;
}
</style>
