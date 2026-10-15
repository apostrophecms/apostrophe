<template>
  <AposModal
    ref="modalEl"
    class="apos-see-changes"
    data-apos-test="see-changes-modal"
    :modal="modal"
    :modal-title="{ key: 'apostrophe:seeChangesTitle' }"
    @inactive="modal.active = false"
    @show-modal="modal.showModal = true"
    @esc="close"
    @no-modal="$emit('safe-close')"
    @ready="focus"
  >
    <template #windowChrome="{ startResizing }">
      <AposWindowResizeHandles
        icon-corner="se"
        @resize="startResizing"
      />
    </template>
    <template #secondaryControls>
      <AposButton
        type="subtle"
        label="apostrophe:seeChangesClose"
        icon="close-icon"
        :icon-only="true"
        :modifiers="[ 'small', 'no-motion' ]"
        :attrs="{ 'data-apos-test': 'see-changes-close' }"
        @click="close"
      />
    </template>
    <template #main>
      <AposModalBody>
        <template #bodyMain />
      </AposModalBody>
    </template>
  </AposModal>
</template>

<script setup>
import {
  onMounted, ref, watch
} from 'vue';
import { useSeeChangesStore } from '../stores/seeChanges.js';

// See Changes' window: a floating window the page stays usable around. It
// lives as long as the mode; closing it leaves the mode
defineEmits([ 'modal-result', 'safe-close' ]);

const SIZE = {
  width: 320,
  height: 420
};
const MARGIN = 16;

const modalEl = ref(null);
const store = useSeeChangesStore();

const modal = ref({
  active: false,
  type: 'window',
  overlay: 'none',
  trapFocus: false,
  showModal: false,
  initialSize: SIZE,
  // Where the user left it, else bottom right
  storageKey: 'aposSeeChangesWindow',
  initialPosition: {
    left: window.innerWidth - SIZE.width - MARGIN,
    top: window.innerHeight - SIZE.height - MARGIN
  },
  minWidth: 280,
  minHeight: 200
});

// The mode ended some other way: Preview, the menu, a context switch
watch(() => store.active, active => {
  if (!active) {
    close();
  }
});

onMounted(() => {
  modal.value.active = true;
});

function focus() {
  // The dialog element sits at the end of the body
  modalEl.value?.$el?.focus({ preventScroll: true });
}

function close() {
  modal.value.showModal = false;
}
</script>
