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
            <template v-if="!unsupported">
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
                    <AposDocVersionMarkerAction
                      class="apos-doc-version-editor__field-change-action"
                      data-apos-test="doc-version-field-change-action"
                      :types="[ 'modified' ]"
                      :ai="isFieldAi(field)"
                      @click="revealChange({ field: field.name })"
                    />
                  </div>
                </template>
              </AposSchema>
            </template>
            <div
              v-else
              class="apos-doc-version-editor__empty"
              data-apos-test="doc-version-unsupported"
            >
              <AposEmptyState :empty-state="unsupportedState" />
            </div>
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
                <template v-if="!unsupported">
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
              :compared="changeCompared"
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
  computed, inject, nextTick, onBeforeUnmount, onMounted, ref, watch
} from 'vue';
import { useInfiniteScroll } from 'Modules/@apostrophecms/ui/composables/useInfiniteScroll.js';
import { useAdvisoryLock } from 'Modules/@apostrophecms/ui/composables/useAdvisoryLock.js';
import { useDocVersionsList } from '../composables/useDocVersionsList.js';
import { useDocVersionView } from '../composables/useDocVersionView.js';
import { useDocVersionTabs } from '../composables/useDocVersionTabs.js';
import { useDocVersionMarkers } from '../composables/useDocVersionMarkers.js';
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
const unsupportedState = { message: 'apostrophe:versionUnsupported' };

// --- Document ---

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
// The module of the version shown, for its schema. A version saved as a type
// the site no longer has is neither shown nor restorable
const moduleOptions = computed(() => apos.modules[docType.value] || {});
const unsupported = computed(() => !apos.modules[docType.value]);
// The lock and a restore address the live document, whatever the version's type
const docAction = computed(() => `${apos.modules[props.doc.type].action}/${docId}`);
const docMeta = computed(() => docFields.value.data?.aposMeta || {});

// --- Schema, conditions and tabs ---

const {
  groups,
  versionTabs,
  currentTab,
  switchPane,
  conditionalFields,
  evaluateExternalConditions,
  evaluateConditions
} = useDocVersionTabs({
  moduleOptions,
  unsupported,
  doc: props.doc,
  docFields
});

// --- Change markers ---

const {
  graphKey,
  isFieldModified,
  isFieldAi
} = useDocVersionMarkers({
  docId,
  widgetChanges,
  docMeta,
  onReveal: revealChange
});

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

function notifyError(message) {
  return apos.notify(message, {
    type: 'danger',
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
    await notifyError('apostrophe:versionFailVersionLoadMessage');
  }
});

// --- Change list ---

// The right panel shows the version list or one version's changes
const view = ref('list');

const {
  rows: changeRows,
  counts: changeCounts,
  compared: changeCompared,
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
    await notifyError('apostrophe:versionFailChangesLoadMessage');
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
  cancelVersions();
  stopScroll();
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
