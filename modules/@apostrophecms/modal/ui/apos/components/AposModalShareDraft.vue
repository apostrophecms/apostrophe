<template>
  <AposModal
    :modal="modal" class="apos-share-draft"
    v-on="mode !== 'alert' ? { 'esc': cancel } : null"
    @no-modal="$emit('safe-close')"
    @inactive="modal.active = false" @show-modal="modal.showModal = true"
  >
    <template #main>
      <AposModalBody>
        <template #bodyMain>
          <h2>Share Draft</h2>
          <p>
            A shared URL to view the draft before publication
          </p>
          <input
            type="text"
            v-model="url"
            readonly
          >
          <button @click="copy">
            Copy Link
          </button>
          <p>Viewing permissions are based on the draft's current Visibility settings</p>
        </template>
      </AposModalBody>
    </template>
  </AposModal>
</template>

<script>

export default {
  emits: [ 'safe-close', 'modal-result' ],
  data() {
    return {
      url: ''
    };
  },
  async mounted() {
    try {
      const { url } = await apos.http.post(`${window.apos.i18n.action}/share-draft`, {
        body: {
          url: window.location.href
        },
        busy: true
      });
      this.url = url;
      this.modal.active = true;
      // Get the data. This will be more complex in actuality.
    } catch (e) {
      apos.alert({
        heading: 'Unable to Share Draft',
        description: 'Unable to obtain a sharing URL for the draft.'
      });
      this.$emit('modal-result', false);
    }
  },
  methods: {
    async copy() {
      this.modal.showModal = false;
      await navigator.clipboard.writeText(this.url);
      this.$emit('modal-result', true);
    },
    async cancel() {
      this.modal.showModal = false;
      this.$emit('modal-result', false);
    }
  }
};
</script>

<style lang="scss" scoped>
.apos-share-draft {
  z-index: $z-index-modal;
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
