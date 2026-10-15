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
    <template #primaryControls>
      <span
        class="apos-see-changes__count"
        data-apos-test="see-changes-count"
      >
        <span aria-hidden="true">·</span>
        {{ $t('apostrophe:seeChangesEdits', { count: rows.length }) }}
      </span>
      <AposDocVersionChangesFilter
        v-if="rows.length"
        v-model="filter"
        :counts="store.payload.counts"
        :shown="shown"
      />
    </template>
    <template #main>
      <AposSeeChangesList
        :rows="rows"
        :baseline="store.payload?.baseline"
        :filter="filter"
      />
    </template>
  </AposModal>
</template>

<script setup>
import {
  computed, onMounted, ref, watch
} from 'vue';
import changeGroups from '../lib/change-groups.js';
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

// The checked filter options, kept when the changes reload
const filter = ref([]);

const rows = computed(() => store.payload?.rows || []);
const shown = computed(() => rows.value
  .filter(row => changeGroups.matchesFilter(row, filter.value)).length);

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

<style lang="scss" scoped>
// Lined up with the list below; its controls set its height
.apos-see-changes :deep(.apos-modal__header__main) {
  padding: $spacing-three-quarters ($spacing-base + $spacing-half);
}

// The count follows the title, the filter goes to the end
.apos-see-changes :deep(.apos-modal__controls--primary) {
  flex-grow: 1;
}

.apos-see-changes :deep(.apos-modal__controls--primary > .apos-context-menu) {
  margin-right: 0;
}

// The list scrolls on its own, under the header
.apos-see-changes :deep(.apos-modal__main) {
  overflow: hidden;
  grid-template-rows: minmax(0, 1fr);
}

.apos-see-changes__count {
  display: inline-flex;
  align-items: center;
  gap: $spacing-half;
  margin-right: auto;
  margin-left: $spacing-half;
  color: var(--a-base-2);
  font-size: var(--a-type-smaller);
  white-space: nowrap;
}
</style>
