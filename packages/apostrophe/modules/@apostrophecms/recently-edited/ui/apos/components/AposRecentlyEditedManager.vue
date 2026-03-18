<template>
  <AposModal
    :modal="modal"
    :modal-title="{ key: 'apostrophe:recentlyEditedDocuments' }"
    class="apos-recently-edited-manager"
    data-apos-test="recently-edited-manager"
    @esc="close"
    @inactive="modal.active = false"
    @show-modal="modal.showModal = true"
  >
    <template #secondaryControls>
      <AposButton
        type="default"
        label="apostrophe:exit"
        @click="close"
      />
    </template>
    <template #main>
      <AposModalBody>
        <template #bodyMain>
          <p>Coming soon</p>
        </template>
      </AposModalBody>
    </template>
  </AposModal>
</template>
<script setup>
import { ref, onMounted } from 'vue';

// eslint-disable-next-line no-unused-vars
const props = defineProps({
  moduleName: {
    type: String,
    required: true
  }
});

const modal = ref({
  active: false,
  showModal: false,
  type: 'overlay'
});

onMounted(() => {
  modal.value.active = true;
});

async function close() {
  modal.value.showModal = false;
}
</script>
