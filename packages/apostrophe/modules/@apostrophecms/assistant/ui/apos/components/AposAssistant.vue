<template>
  <AposModal
    class="apos-assistant"
    data-apos-test="assistant"
    :modal="modal"
    :modal-title="{ key: 'apostrophe:assistantTitle' }"
    :modal-data="modalData"
    @inactive="modal.active = false"
    @show-modal="modal.showModal = true"
    @esc="close"
    @no-modal="$emit('safe-close')"
  >
    <template #windowChrome="{ startResizing }">
      <AposWindowResizeHandles
        icon-corner="se"
        @resize="startResizing"
      />
    </template>
    <!-- The assistant works across locales; each request says its own -->
    <template #localeDisplay />
    <template #primaryControls>
      <AposButton
        type="subtle"
        label="apostrophe:assistantClose"
        icon="chevron-down-icon"
        :icon-only="true"
        :modifiers="[ 'small', 'no-motion' ]"
        :attrs="{ 'data-apos-test': 'assistant-close' }"
        @click="close"
      />
    </template>
    <template #main>
      <div
        class="apos-assistant__body"
        @dragenter="onDragOver"
        @dragover="onDragOver"
        @dragleave="onDragLeave"
        @drop="onDrop"
      >
        <AposAssistantTabs />
        <AposAssistantThread
          :key="store.activeId"
          :chat-id="store.activeId"
        />
        <AposAssistantComposer
          :chat-id="store.activeId"
          :dropping="dropping"
        />
      </div>
    </template>
  </AposModal>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useAssistantStore } from '../stores/assistant.js';

// The assistant's window: above the page and every modal, never taking
// focus from them. Everything it shows is the stored records with the
// editor's actions not answered yet shown over them (the store)
const props = defineProps({
  modalData: {
    type: Object,
    required: true
  },
  // Opened again by the page after the assistant moved to another one, not
  // by the editor: focus stays on the page
  resumed: {
    type: Boolean,
    default: false
  }
});
defineEmits([ 'modal-result', 'safe-close' ]);

const SIZE = {
  width: 420,
  height: 600
};
const MARGIN = 16;
const MIN_HEIGHT = 360;

const store = useAssistantStore();
// Files are dragged over the window and the active chat tab takes them
const dropping = ref(false);

const modal = ref({
  active: false,
  type: 'window',
  overlay: 'none',
  stacking: 'top',
  showModal: false,
  initialSize: getSize(),
  // Where the editor left it, else the bottom right corner
  storageKey: 'aposAssistantWindow',
  initialPosition: getPosition(),
  minWidth: 320,
  minHeight: MIN_HEIGHT,
  // The thread's text stays selectable
  dragFrom: 'header'
});

// The chat tabs are restored before the first render
store.start();

onMounted(() => {
  modal.value.active = true;
  if (!props.resumed) {
    store.focusComposer();
  }
});

function close() {
  modal.value.showModal = false;
}

// Files dropped anywhere on the window attach to the active chat tab;
// text and links are left to the composer's input. Files are never left to
// the browser, which would open them in place of the page
function onDragOver(event) {
  if (!hasFiles(event)) {
    return;
  }
  event.preventDefault();
  const allowed = store.canAttach(store.activeId);
  event.dataTransfer.dropEffect = allowed ? 'copy' : 'none';
  dropping.value = allowed;
}

function onDragLeave(event) {
  if (!event.currentTarget.contains(event.relatedTarget)) {
    dropping.value = false;
  }
}

function onDrop(event) {
  if (!hasFiles(event)) {
    return;
  }
  event.preventDefault();
  dropping.value = false;
  if (store.canAttach(store.activeId)) {
    store.attachFiles(store.activeId, [ ...event.dataTransfer.files ]);
  }
}

function hasFiles(event) {
  return Boolean(event.dataTransfer?.types?.includes('Files'));
}

function getSize() {
  const adminBar = window.apos?.adminBar?.height || 0;
  const room = window.innerHeight - adminBar - MARGIN * 2;
  return {
    width: SIZE.width,
    height: Math.max(MIN_HEIGHT, Math.min(SIZE.height, room))
  };
}

function getPosition() {
  const size = getSize();
  return {
    left: Math.max(MARGIN, window.innerWidth - size.width - MARGIN),
    top: Math.max(MARGIN, window.innerHeight - size.height - MARGIN)
  };
}
</script>

<style lang="scss" scoped>
  .apos-assistant :deep(.apos-modal__main) {
    overflow: hidden;
  }

  // A grid item: a step's code never widens the window
  .apos-assistant__body {
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    height: 100%;
  }
</style>
