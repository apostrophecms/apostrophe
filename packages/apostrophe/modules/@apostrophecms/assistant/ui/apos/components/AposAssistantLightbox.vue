<template>
  <AposModal
    class="apos-assistant-lightbox"
    data-apos-test="assistant-lightbox"
    :modal="modal"
    :modal-title="alt"
    :modal-data="modalData"
    @inactive="modal.active = false"
    @show-modal="modal.showModal = true"
    @esc="close"
    @no-modal="$emit('safe-close')"
  >
    <template #main>
      <div
        class="apos-assistant-lightbox__stage"
        tabindex="0"
        data-apos-focus-priority
        @click="close"
      >
        <img
          class="apos-assistant-lightbox__image"
          :src="src"
          :alt="alt"
          data-apos-test="assistant-lightbox-image"
        >
      </div>
    </template>
  </AposModal>
</template>

<script setup>
import { onMounted, ref } from 'vue';

// One image shown large, above the page and the assistant's window, and
// nothing else: Escape or a click closes it. It takes the focus, as the
// modal's focus priority, so Escape closes it and not the window under it
defineProps({
  modalData: {
    type: Object,
    required: true
  },
  src: {
    type: String,
    required: true
  },
  alt: {
    type: String,
    default: ''
  }
});
const emit = defineEmits([ 'modal-result', 'safe-close' ]);

const modal = ref({
  active: false,
  type: 'overlay',
  showModal: false,
  disableHeader: true,
  stacking: 'top',
  trapFocus: true
});

onMounted(() => {
  modal.value.active = true;
});

function close() {
  emit('modal-result', null);
  modal.value.showModal = false;
}
</script>

<style lang="scss" scoped>
  .apos-assistant-lightbox {
    :deep(.apos-modal__overlay) {
      background-color: color-mix(in srgb, var(--a-black) 72%, transparent);
    }

    :deep(.apos-modal__inner) {
      inset: 0;
      width: auto;
      max-width: none;
      height: 100vh;
      border: none;
      border-radius: 0;
      background-color: transparent;
    }

    :deep(.apos-modal__main) {
      overflow: hidden;
    }
  }

  .apos-assistant-lightbox__stage {
    display: grid;
    box-sizing: border-box;
    place-items: center;
    height: 100%;
    padding: 32px;
    outline: none;
    cursor: zoom-out;
  }

  .apos-assistant-lightbox__image {
    display: block;
    max-width: min(1100px, 100%);
    max-height: calc(100vh - 64px);
    border-radius: var(--a-border-radius);
    object-fit: contain;
  }
</style>
