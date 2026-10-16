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
    <!-- The window is about the page in its own locale -->
    <template #localeDisplay />
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
        ref="listEl"
        v-model:filter="filter"
        :rows="rows"
        :baseline="store.payload?.baseline"
        :on-page="onPage"
        @navigate="navigateTo"
      />
    </template>
  </AposModal>
</template>

<script setup>
import {
  computed, onBeforeUnmount, onMounted, ref, watch
} from 'vue';
import { useWidgetStore } from 'Modules/@apostrophecms/ui/stores/widget.js';
import changeGroups from '../lib/change-groups.js';
import { useSeeChangesStore } from '../stores/seeChanges.js';
import { useDocVersionTarget } from '../composables/useDocVersionTarget.js';

// See Changes' window: a floating window the page stays usable around. It
// lives as long as the mode; closing it leaves the mode
defineEmits([ 'modal-result', 'safe-close' ]);

const SIZE = {
  width: 320,
  height: 420
};
const MARGIN = 16;

const modalEl = ref(null);
const listEl = ref(null);
const store = useSeeChangesStore();
const widgetStore = useWidgetStore();

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
  apos.bus.$on('doc-version-marker', onWidgetMarker);
});

onBeforeUnmount(() => {
  apos.bus.$off('doc-version-marker', onWidgetMarker);
});

function focus() {
  // The dialog element sits at the end of the body
  modalEl.value?.$el?.focus({ preventScroll: true });
}

function close() {
  modal.value.showModal = false;
}

// --- From the list to the page ---

// Whether the page shows the group the navigator is at
const onPage = ref(true);

// Scrolled to only when it is out of sight, as an undo's change is
const {
  show: showTarget,
  clear: clearTarget
} = useDocVersionTarget({
  attribute: 'data-apos-see-changes-target',
  scroll(el) {
    if (!widgetStore.isElementInView(el)) {
      widgetStore.scrollToElement(el);
    }
  }
});

function navigateTo(group) {
  if (!group) {
    clearTarget();
    onPage.value = true;
    return;
  }
  onPage.value = showTarget(getTarget(group));
}

// Where the page shows a group: its widget, the field rendered in place,
// or for the order of an area its first moved widget. Nothing for a field
// the page does not render
function getTarget(group) {
  const page = document.querySelector('[data-apos-refreshable]');
  const find = selector => page?.querySelector(selector) || null;
  const byId = id => find(`[data-apos-widget-id="${CSS.escape(id)}"]`);
  const [ field, widget ] = group.path;
  if (widget) {
    return byId(widget.name);
  }
  const order = group.entries.find(entry => entry.order);
  if (order) {
    const ids = order.row.new || [];
    const moved = ids.find(id => store.widgetChanges[id]?.changes.includes('moved'));
    return byId(moved || ids[0]);
  }
  return find(
    `[data-apos-wysiwyg-field-editable][data-patch-key="${CSS.escape(field.name)}"]`
  );
}

// --- From the page to the list ---

// A widget's marker on the page shows the changes behind it
function onWidgetMarker({ graphKey, widgetId }) {
  if (!graphKey || (graphKey !== store.docId)) {
    return;
  }
  listEl.value?.reveal({
    widgetId,
    moved: Boolean(store.widgetChanges[widgetId]?.changes.includes('moved')),
    marked: store.widgetChanges
  });
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

// The locale's empty place takes no room
.apos-see-changes :deep(.apos-modal__locale) {
  margin-right: 0;
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

<style lang="scss">
// The widget or field of the page the navigator is at
[data-apos-see-changes-target] {
  border-radius: var(--a-border-radius-large);
  outline: 2px solid var(--a-primary);
  outline-offset: 2px;
}
</style>
