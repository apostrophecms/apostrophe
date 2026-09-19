<template>
  <AposModal
    class="apos-doc-editor apos-doc-version-editor"
    data-apos-test="doc-version-modal"
    :modal="modal"
    :modal-title="{ key: 'apostrophe:versionPluralLabel' }"
    :graph-key="graphKey"
    @inactive="modal.active = false"
    @show-modal="modal.showModal = true"
    @esc="close"
    @no-modal="$emit('safe-close')"
    @ready="startScroll"
  >
    <template #secondaryControls>
      <AposButton
        type="default"
        label="apostrophe:cancel"
        @click="close"
      />
    </template>
    <template #leftRail>
      <AposModalRail collapsible>
        <AposModalTabs
          v-if="versionTabs.length"
          :current="currentTab"
          :tabs="versionTabs"
          @select-tab="switchPane"
        />
      </AposModalRail>
    </template>
    <template #main>
      <AposModalBody>
        <template #bodyMain>
          <div
            v-if="versions.length"
            ref="body"
            class="apos-doc-editor__body apos-doc-version-editor__body"
          >
            <AposSchema
              v-for="tab in versionTabs"
              v-show="tab.name === currentTab"
              :key="tab.name"
              :schema="groups[tab.name]?.schema || []"
              :current-fields="groups[tab.name]?.fields || []"
              :utility-rail="false"
              :conditional-fields="conditionalFields"
              :doc-id="docId"
              :model-value="docFields"
              :generation="generation"
              :meta="docMeta"
              @update:model-value="evaluateConditions()"
            >
              <template #beforeField="{ field }">
                <div
                  v-if="isFieldModified(field)"
                  class="apos-doc-version-editor__field-change"
                  data-apos-test="doc-version-field-change"
                >
                  <button
                    v-apos-tooltip="'apostrophe:versionSeeChanges'"
                    type="button"
                    class="apos-doc-version-editor__field-change-action"
                    data-apos-test="doc-version-field-change-action"
                    :aria-label="$t('apostrophe:versionSeeChanges')"
                    @click="revealChange({ field: field.name })"
                  >
                    <AposDocVersionAiBadge v-if="isFieldAi(field)" />
                    <AposDocVersionChangeType
                      type="modified"
                      icon
                    />
                  </button>
                </div>
              </template>
            </AposSchema>
          </div>
          <div
            v-else-if="loaded"
            class="apos-doc-version-editor__empty"
          >
            <AposEmptyState :empty-state="emptyState" />
          </div>
        </template>
      </AposModalBody>
    </template>
    <template #rightRail>
      <AposModalRail type="right">
        <AposDocVersionsPanel :view="view">
          <template #list>
            <AposDocVersionsList
              ref="versionList"
              :current-version="currentVersion"
              :versions="versions"
              @select="selectVersion"
            >
              <template #actions="{ version }">
                <AposButton
                  ref="viewChangesButton"
                  type="quiet"
                  label="apostrophe:versionViewChanges"
                  :attrs="{ 'data-apos-test': 'doc-version-action-changes' }"
                  @click="viewChanges(version)"
                />
                <AposButton
                  type="quiet"
                  label="apostrophe:versionRestore"
                  :attrs="{ 'data-apos-test': 'doc-version-action-restore' }"
                  @click="restoreVersion(version)"
                />
              </template>
            </AposDocVersionsList>
            <div
              ref="scrollSentinel"
              class="apos-doc-version-sentinel"
            />
          </template>
          <template #changes>
            <AposDocVersionsChanges
              ref="changesPane"
              :version="currentVersion"
              :rows="changeRows"
              :counts="changeCounts"
              @back="backToList"
              @navigate="navigateTo"
            />
          </template>
        </AposDocVersionsPanel>
      </AposModalRail>
    </template>
  </AposModal>
</template>

<script setup>
import {
  computed, inject, nextTick, onBeforeUnmount, onMounted, provide, ref, watch
} from 'vue';
import { klona } from 'klona';
import {
  evaluateExternalConditions as evaluateSchemaExternalConditions,
  getConditionalFields,
  getConditionTypesObject
} from 'Modules/@apostrophecms/schema/lib/conditionalFields.js';
import { useInfiniteScroll } from 'Modules/@apostrophecms/ui/composables/useInfiniteScroll.js';
import { useAdvisoryLock } from 'Modules/@apostrophecms/ui/composables/useAdvisoryLock.js';
import { useWidgetGraphStore } from 'Modules/@apostrophecms/ui/stores/widgetGraph.js';
import { useDocVersionMarkersStore } from '../stores/docVersionMarkers.js';
import { useDocVersionsList } from '../composables/useDocVersionsList.js';
import { useDocVersionView } from '../composables/useDocVersionView.js';
import { useDocVersionChanges } from '../composables/useDocVersionChanges.js';
import { useDocVersionTarget } from '../composables/useDocVersionTarget.js';
import { useDocVersionRestore } from '../composables/useDocVersionRestore.js';

const props = defineProps({
  // The versions module
  moduleName: {
    type: String,
    required: true
  },
  doc: {
    type: Object,
    required: true
  }
});

defineEmits([ 'modal-result', 'safe-close' ]);

const $t = inject('i18n');

const modal = ref({
  active: false,
  type: 'overlay',
  showModal: false
});

const scrollSentinel = ref(null);
const emptyState = { message: 'apostrophe:versionsNotFound' };

// --- Document and schema ---

const docId = props.doc._id;
const versionsAction = apos.modules[props.moduleName].action;

const {
  docFields,
  widgetChanges,
  generation,
  show,
  fetchVersion
} = useDocVersionView({ action: versionsAction });

const docType = computed(() => docFields.value.data?.type || props.doc.type);
const moduleOptions = computed(() => apos.modules[docType.value] || {});
const docAction = computed(() => `${moduleOptions.value.action}/${docId}`);
const docMeta = computed(() => docFields.value.data?.aposMeta || {});

const schema = computed(() => {
  const fields = (moduleOptions.value.schema || [])
    .filter(field => apos.schema.components.fields[field.type])
    .filter(field => field.name !== 'archived');
  return klona(fields).map(field => ({
    ...field,
    readOnly: true
  }));
});

// --- Change markers ---

// The modal's own widget graph: its widgets share their ids with those of
// the page under it. Nested areas, apps of their own, find the key on the
// modal element
const graphKey = `document-versions:${docId}`;
provide('aposGraphKey', graphKey);

const widgetGraphStore = useWidgetGraphStore();
const markersStore = useDocVersionMarkersStore();

// Known from the start, so that what renders in the modal renders for it
markersStore.set(graphKey, {});
watch(widgetChanges, changes => {
  markersStore.set(graphKey, changes);
});

// A change outside any widget marks its top-level field
function isFieldModified(field) {
  return Boolean(docMeta.value[field.name]?.['@apostrophecms/schema:highlight']);
}

function isFieldAi(field) {
  return Boolean(docMeta.value[field.name]?.['@apostrophecms/document-versions:ai']);
}

// --- Conditional fields ---

const externalConditionsResults = ref(getConditionTypesObject());
const conditionalFields = ref(getConditionTypesObject());

async function evaluateExternalConditions() {
  externalConditionsResults.value = await evaluateSchemaExternalConditions(
    schema.value,
    docId,
    $t
  );
}

// With no version to show, the tabs follow the live document
function evaluateConditions(data = docFields.value.data) {
  conditionalFields.value = getConditionalFields(
    schema.value,
    data,
    externalConditionsResults.value
  );
}

// --- Tabs ---

const currentTab = ref(null);

function isParked(fieldName) {
  return (props.doc.parked || []).includes(fieldName);
}

const groups = computed(() => {
  const groupSet = {};
  for (const field of schema.value) {
    if (isParked(field.name) || !field.group) {
      continue;
    }
    const { group } = field;
    groupSet[group.name] = groupSet[group.name] || {
      label: group.label,
      fields: [],
      schema: []
    };
    groupSet[group.name].fields.push(field.name);
    groupSet[group.name].schema.push(field);
  }
  return groupSet;
});

function isTabVisible(fields) {
  return fields.some(field => conditionalFields.value.if[field] !== false);
}

const versionTabs = computed(() => {
  const tabs = Object.entries(groups.value)
    .filter(([ name ]) => name !== 'utility')
    .map(([ name, group ]) => ({
      name,
      label: group.label,
      fields: group.fields,
      isVisible: isTabVisible(group.fields)
    }));
  const fields = groups.value.utility?.fields || [];
  tabs.push({
    name: 'utility',
    label: 'apostrophe:utility',
    fields,
    isVisible: isTabVisible(fields)
  });
  return tabs;
});

watch(versionTabs, (tabs) => {
  const current = tabs.find(tab => tab.name === currentTab.value);
  if (current?.isVisible) {
    return;
  }
  const first = tabs.find(tab => tab.isVisible) || tabs[0];
  currentTab.value = first?.name || null;
}, { immediate: true });

function switchPane(name) {
  currentTab.value = name;
}

// --- Version list ---

const {
  versions,
  loaded,
  load: loadVersions,
  loadMore,
  cancel: cancelVersions
} = useDocVersionsList({
  action: versionsAction,
  docId
});

// Started once the modal displays its content: observed while it is still
// hidden, the sentinel has no size and never reports
const {
  start: startScroll,
  stop: stopScroll,
  recheck
} = useInfiniteScroll(scrollSentinel, loadMoreVersions, {
  // About four rows ahead of the end
  rootMargin: '0px 0px 150px 0px',
  root: '.apos-doc-versions-panel__pane'
});

async function loadMoreVersions() {
  try {
    await loadMore();
  } catch (e) {
    await notifyListError(e);
  }
}

// The sentinel may still be in view after an append: ask the observer again
watch(versions, () => {
  nextTick(recheck);
});

async function notifyListError(e) {
  const message = e.status === 404
    ? 'apostrophe:versionFailDocPermsMessage'
    : 'apostrophe:versionFailDocLoadMessage';
  await apos.notify(message, {
    type: 'warning',
    icon: 'alert-circle-icon',
    dismiss: true
  });
}

// --- Selection ---

const currentVersion = ref(null);
const currentVersionId = computed(() => currentVersion.value?._id || null);

function selectVersion(item) {
  if (currentVersionId.value !== item._id) {
    currentVersion.value = item;
  }
}

watch(currentVersionId, async (versionId) => {
  if (!versionId) {
    return;
  }
  try {
    const consolidate = Boolean(currentVersion.value.versionIds);
    if (await show(versionId, { consolidate })) {
      evaluateConditions();
    }
  } catch (e) {
    await apos.notify('apostrophe:versionFailVersionLoadMessage', {
      type: 'danger',
      icon: 'alert-circle-icon',
      dismiss: true
    });
  }
});

// --- Change list ---

// The right panel shows the version list or one version's changes
const view = ref('list');

const {
  rows: changeRows,
  counts: changeCounts,
  load: loadChanges
} = useDocVersionChanges({ action: versionsAction });

const viewChangesButton = ref(null);
const changesPane = ref(null);

// The pane leaving is inert, so focus follows the swap: to Back on the
// way in, to View Changes on the way out
async function viewChanges(version) {
  try {
    const consolidate = Boolean(version.versionIds);
    if (await loadChanges(version._id, { consolidate })) {
      view.value = 'changes';
      await nextTick();
      changesPane.value?.focus();
    }
  } catch (e) {
    await apos.notify('apostrophe:versionFailChangesLoadMessage', {
      type: 'danger',
      icon: 'alert-circle-icon',
      dismiss: true
    });
  }
}

// The list pane never unmounts, so its selection and scroll are as left
async function backToList() {
  view.value = 'list';
  clearTarget();
  await nextTick();
  viewChangesButton.value?.focus();
}

// --- From a marker to its changes ---

// A marker of the body opens the change list when it is not open, then
// shows the changes behind it
async function revealChange(target) {
  if (view.value !== 'changes') {
    await viewChanges(currentVersion.value);
  }
  if (view.value === 'changes') {
    await nextTick();
    await changesPane.value?.reveal(target);
  }
}

// Widgets of nested areas render in apps of their own, hence the bus
function onWidgetMarker({ graphKey: key, widgetId }) {
  if (key === graphKey) {
    revealChange({
      widgetId,
      moved: Boolean(widgetChanges.value[widgetId]?.changes.includes('moved'))
    });
  }
}

// --- Change navigator ---

const body = ref(null);

const {
  show: showTarget,
  clear: clearTarget
} = useDocVersionTarget({ attribute: 'data-apos-doc-version-target' });

// Selects the tab holding the group's top-level field, then highlights
// the field, or the widget when the group is one (a deleted widget is
// gone from this version, so its area stands in)
async function navigateTo(group) {
  clearTarget();
  if (!group) {
    return;
  }
  const [ field, widget ] = group.path;
  const tab = versionTabs.value.find(tab => tab.fields.includes(field.name));
  if (!tab?.isVisible || !body.value) {
    return;
  }
  currentTab.value = tab.name;
  await nextTick();
  const fieldEl = body.value.querySelector(
    `:scope > .apos-schema > [data-apos-field="${CSS.escape(field.name)}"]`
  );
  const widgetEl = widget && body.value.querySelector(
    `[data-apos-widget-id="${CSS.escape(widget.name)}"]`
  );
  showTarget(widgetEl || fieldEl);
}

// --- Lock ---

// Held for the modal's lifetime; the restore action reuses it
const {
  lock,
  addLockToRequest,
  isLockedError,
  showLockedError
} = useAdvisoryLock({ onLockLost: close });

// --- Restore ---

const versionList = ref(null);

const { restore } = useDocVersionRestore({
  docAction,
  originalDoc: props.doc,
  fetchVersion,
  lock: {
    addLockToRequest,
    isLockedError,
    showLockedError
  },
  onRestored: showRestored
});

// A consolidated version restores its newest version, the one it shows
async function restoreVersion(version) {
  const confirmed = await apos.confirm({
    heading: 'apostrophe:versionRestore',
    description: 'apostrophe:versionRestoreConfirm',
    affirmativeLabel: 'apostrophe:versionRestore'
  }, {
    interpolate: {
      type: $t(moduleOptions.value.label)
    }
  });
  if (confirmed) {
    await restore(version);
  }
}

// The restore is the newest version now: select it, and move focus there
// since the Restore button left with the old selection
async function showRestored() {
  try {
    await loadVersions();
  } catch (e) {
    await notifyListError(e);
    return;
  }
  const [ newest ] = versions.value;
  if (newest) {
    selectVersion(newest);
    await nextTick();
    versionList.value?.focus(newest._id);
  }
}

// --- Lifecycle ---

function close() {
  modal.value.showModal = false;
}

onMounted(async () => {
  modal.value.active = true;
  apos.bus.$on('doc-version-marker', onWidgetMarker);
  try {
    if (!(await lock(docAction.value))) {
      close();
      return;
    }
    await evaluateExternalConditions();
    await loadVersions();
  } catch (e) {
    await notifyListError(e);
    close();
    return;
  }
  if (versions.value.length) {
    selectVersion(versions.value[0]);
  } else {
    evaluateConditions(props.doc);
  }
});

onBeforeUnmount(() => {
  apos.bus.$off('doc-version-marker', onWidgetMarker);
  cancelVersions();
  stopScroll();
  markersStore.clear(graphKey);
  widgetGraphStore.destroyGraph(graphKey);
});
</script>

<style lang="scss" scoped>
:deep(.apos-modal__rail--right) {
  border-left: 1px solid var(--a-base-8);
}

:deep(.apos-modal__main--with-rails) {
  grid-template-columns: 15% 1fr minmax(250px, 22%);

  @include media-up(lap) {
    grid-template-columns: 220px 1fr 320px;
  }

  &:has(> .apos-modal__rail--collapsed) {
    grid-template-columns: $modal-rail-collapsed-w 1fr minmax(250px, 22%);

    @include media-up(lap) {
      grid-template-columns: $modal-rail-collapsed-w 1fr 320px;
    }
  }
}

.apos-doc-version-sentinel {
  height: 2px;
}

.apos-doc-version-editor {
  &__empty {
    display: flex;
    justify-content: center;
  }

  // On the right, where a widget's frame has it
  &__field-change {
    display: flex;
    justify-content: flex-end;
    margin-bottom: $spacing-half;
  }

  &__field-change-action {
    display: flex;
    gap: $spacing-half;
    margin: 0;
    padding: 0;
    border: 0;
    background: none;
    cursor: pointer;
    // The body blocks the pointer
    pointer-events: auto;

    &:focus-visible {
      border-radius: var(--a-border-radius);
      outline: 2px solid var(--a-primary);
      outline-offset: 2px;
    }
  }

  // A modified field, framed as a modified widget is
  :deep([data-apos-field]:has(> .apos-doc-version-editor__field-change)) {
    display: flow-root;
    box-sizing: border-box;
    margin-bottom: $spacing-quadruple;
    padding: $spacing-half;
    border: 2px dashed var(--a-warning);
    border-radius: var(--a-border-radius-large);
    background-color: color-mix(in srgb, var(--a-warning) 6%, transparent);

    > .apos-field__wrapper > .apos-field {
      margin-bottom: 0;
      padding: 0;
      background: none;
    }
  }

  // The field or widget the change navigator points at
  :deep([data-apos-doc-version-target]) {
    border-radius: 2px;
    outline: 2px solid var(--a-primary);
    outline-offset: 4px;
    background-color: var(--a-primary-transparent-05);
    box-shadow: 0 0 0 4px var(--a-primary-transparent-05);
  }

  &__body {
    // For now. Later we may have better support for read-only areas
    // and array fields that allows clicking in to see more information
    // but carefully blocks editing
    pointer-events: none;
  }
}
</style>
