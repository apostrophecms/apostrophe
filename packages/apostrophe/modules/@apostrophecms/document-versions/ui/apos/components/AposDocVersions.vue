<template>
  <AposModal
    class="apos-doc-editor apos-doc-version-editor"
    :class="classes"
    data-apos-test="doc-version-modal"
    :modal="modal"
    :modal-title="{ key: 'apostrophe:versionPluralLabel' }"
    @inactive="modal.active = false"
    @show-modal="modal.showModal = true"
    @esc="close"
    @no-modal="$emit('safe-close')"
  >
    <template #secondaryControls>
      <AposButton
        type="default"
        label="apostrophe:cancel"
        @click="close"
      />
    </template>
    <template #primaryControls>
      <AposContextMenu
        :disabled="!versions.length"
        :button="{
          label: $t('apostrophe:viewOptions'),
          icon: 'view-split-vertical-icon',
          type: 'outline'
        }"
        :unpadded="true"
        menu-placement="bottom-end"
        data-apos-test="doc-version-view-options-menu"
        :dynamic-focus="true"
      >
        <dl
          class="apos-doc-version__view-options-menu"
          role="menu"
          aria-label="menu"
        >
          <dt
            v-for="item in operations"
            :key="item.action"
            class="apos-doc-version__view-options-menu__item"
            :class="{
              'apos-doc-version__view-options-menu__item--disabled': item.disabled
            }"
          >
            <button
              class="apos-doc-version__view-options-menu__item__button"
              data-apos-test="doc-version-view-options-select"
              :value="$t(item.label)"
              :disabled="item.disabled"
              @click="toggleOperation(item.action)"
            >
              <p class="apos-doc-version__view-options-menu__item__label">
                {{ $t(item.label) }}
              </p>
              <AposToggle
                class="apos-doc-version__view-options-menu__item__toggle"
                :model-value="!item.enabled"
                :disable-focus="true"
              />
            </button>
          </dt>
        </dl>
      </AposContextMenu>
      <AposButton
        :disabled="!versions.length"
        type="primary"
        class="apos-doc-version__action"
        data-apos-test="doc-version-action-restore"
        :label="$t('apostrophe:restore')"
        @click="restoreVersion(currentVersion)"
      />
    </template>
    <template #leftRail>
      <AposModalRail
        v-if="displayTabs"
        :class="{ 'apos-modal__rail--down': displayComparison }"
      >
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
            v-if="displayComparison"
            class="apos-doc-version-editor__compare"
          >
            <div class="apos-doc-version-editor__compare-header">
              {{ toHumanDate(currentVersion.createdAt) }}
            </div>
            <div class="separator" />
            <div class="apos-doc-version-editor__compare-header">
              <AposDocVersionsListCompare
                :current-version="compareVersion"
                :versions="versionsCompare"
                @select="selectCompareVersion"
                @load-more="loadMoreVersions"
              />
            </div>
          </div>
          <div
            v-if="versions.length"
            class="apos-doc-editor__body apos-doc-version-editor__body"
            :class="{ 'apos-doc-version-editor__body--compare': displayComparison }"
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
            />
          </div>
          <div
            v-else-if="loaded"
            class="apos-doc-version-editor__body"
          >
            <p class="apos-doc-version-editor__empty-title">
              {{ $t('apostrophe:versionsNotFound') }}
            </p>
          </div>
        </template>
      </AposModalBody>
    </template>
    <template #rightRail>
      <AposModalRail type="right">
        <AposDocVersionsList
          :current-version="currentVersion"
          :versions="versions"
          @select="selectVersion"
        />
        <div
          ref="scrollSentinel"
          class="apos-doc-version-sentinel"
        />
      </AposModalRail>
    </template>
  </AposModal>
</template>

<script setup>
import {
  computed, inject, nextTick, onBeforeUnmount, onMounted, ref, watch
} from 'vue';
import { klona } from 'klona';
import { useModalStore } from 'Modules/@apostrophecms/ui/stores/modal';
import {
  evaluateExternalConditions as evaluateSchemaExternalConditions,
  getConditionalFields,
  getConditionTypesObject
} from 'Modules/@apostrophecms/schema/lib/conditionalFields.js';
import { useInfiniteScroll } from 'Modules/@apostrophecms/ui/composables/useInfiniteScroll.js';
import { useAdvisoryLock } from 'Modules/@apostrophecms/ui/composables/useAdvisoryLock.js';
import { useDocVersionsList } from '../composables/useDocVersionsList.js';
import { useDocVersionView } from '../composables/useDocVersionView.js';
import locale from '../utils/locale.js';

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

const emit = defineEmits([ 'modal-result', 'safe-close' ]);

const $t = inject('i18n');
const modalStore = useModalStore();
const dateTimeFormat = locale.getDateTimeFormat();

const modal = ref({
  active: false,
  type: 'overlay',
  showModal: false
});

const scrollSentinel = ref(null);

// --- Document and schema ---

const docId = props.doc._id;
const versionsAction = apos.modules[props.moduleName].action;

const {
  version,
  docFields,
  compareSchema,
  displayComparison,
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
const currentSchema = computed(() => compareSchema.value || schema.value);

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

function evaluateConditions() {
  conditionalFields.value = getConditionalFields(
    schema.value,
    docFields.value.data,
    externalConditionsResults.value
  );
}

// --- Tabs ---

// Off when only the differences of a comparison are shown
const displayTabs = ref(true);
const currentTab = ref(null);

function isParked(fieldName) {
  return (props.doc.parked || []).includes(fieldName);
}

const groups = computed(() => {
  const groupSet = {};
  for (const field of currentSchema.value) {
    if (isParked(field.name)) {
      continue;
    }
    const group = displayTabs.value
      ? field.group
      : {
        name: 'basics',
        label: 'apostrophe:basics'
      };
    if (!group) {
      continue;
    }
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

const {
  start: startScroll,
  stop: stopScroll,
  recheck
} = useInfiniteScroll(scrollSentinel, loadMoreVersions, {
  // About four rows ahead of the end
  rootMargin: '0px 0px 150px 0px',
  root: '.apos-modal__rail--right'
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

// --- Selection and comparison ---

const currentVersion = ref(null);
const compareVersion = ref(null);
const compareEnabled = ref(false);
const onlyDifferences = ref(false);

const currentVersionId = computed(() => currentVersion.value?._id || null);
const compareVersionId = computed(() => compareVersion.value?._id || null);
const versionsCompare = computed(() => {
  return versions.value.filter(item => item._id !== currentVersionId.value);
});

const operations = computed(() => [
  {
    label: 'apostrophe:compareVersions',
    action: 'compare',
    enabled: compareEnabled.value,
    disabled: false
  },
  {
    label: 'apostrophe:onlyShowDifferences',
    action: 'onlyShowDifferences',
    enabled: onlyDifferences.value,
    disabled: !compareEnabled.value
  }
]);

function toggleOperation(action) {
  if (action === 'compare') {
    compareEnabled.value = !compareEnabled.value;
    if (!compareEnabled.value) {
      onlyDifferences.value = false;
    }
    return;
  }
  onlyDifferences.value = !onlyDifferences.value;
}

watch(compareEnabled, (enabled) => {
  compareVersion.value = enabled
    ? (versionsCompare.value[0] || null)
    : null;
});

watch(onlyDifferences, (enabled) => {
  displayTabs.value = !enabled;
});

function selectVersion(item) {
  if (currentVersionId.value !== item._id) {
    currentVersion.value = item;
  }
}

function selectCompareVersion(item) {
  if (compareVersionId.value !== item._id) {
    compareVersion.value = item;
  }
}

watch([ currentVersionId, compareVersionId ], async ([ versionId, compareId ]) => {
  if (!versionId) {
    return;
  }
  try {
    const shown = await show(versionId, compareEnabled.value ? compareId : null);
    if (shown) {
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

const classes = computed(() => ({
  'apos-doc-version-editor--compare': displayComparison.value,
  'apos-doc-version-editor--highlights-only': !displayTabs.value
}));

// --- Lock and restore ---

const {
  lock,
  addLockToRequest,
  isLockedError,
  showLockedError
} = useAdvisoryLock({ onLockLost: close });

async function restoreVersion(item) {
  let doc = item.doc;
  if (!doc && version.value?._id === item._id) {
    doc = version.value.doc;
  }
  if (!doc) {
    try {
      doc = (await fetchVersion(item._id)).doc;
    } catch (e) {
      doc = null;
    }
  }
  if (!doc) {
    await notifyRestoreError();
    return;
  }

  try {
    doc = klona(doc);
    addLockToRequest(doc);
    const updated = await apos.http.put(docAction.value, {
      body: doc,
      busy: true,
      draft: true
    });

    apos.notify('apostrophe:versionRestored', {
      type: 'success',
      icon: 'archive-arrow-up-icon',
      dismiss: true
    });

    if (refreshRedirect(props.doc, updated)) {
      return;
    }
    apos.bus.$emit('content-changed', {
      doc: updated,
      action: 'restoreVersion'
    });
    emit('modal-result', updated);
    close();
  } catch (e) {
    if (isLockedError(e)) {
      await showLockedError(e);
      return;
    }
    await notifyRestoreError();
  }
}

function notifyRestoreError() {
  return apos.notify('apostrophe:versionFailVersionRestoreMessage', {
    type: 'danger',
    icon: 'alert-circle-icon',
    dismiss: true
  });
}

// In-context editing: a restored slug moves the page under our feet
function refreshRedirect(oldDoc, newDoc) {
  const isInContextEdit = modalStore.stack.length === 1;
  if (isInContextEdit && oldDoc.slug !== newDoc.slug) {
    const current = new URL(window.location.href);
    if (!newDoc._url.match(current.pathname)) {
      window.location = newDoc._url;
      return true;
    }
  }
  return false;
}

// --- Lifecycle ---

function close() {
  modal.value.showModal = false;
}

function toHumanDate(date) {
  return dateTimeFormat.format(new Date(date));
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
  }
  await nextTick();
  startScroll();
});

onBeforeUnmount(() => {
  cancelVersions();
  stopScroll();
});
</script>

<style lang="scss" scoped>
:deep(.apos-modal__main--with-rails) {
  grid-template-columns: 15% 1fr minmax(250px, 22%);
}

.apos-doc-version-sentinel {
  height: 2px;
}

.apos-doc-version-editor {
  &__empty-title {
    display: flex;
    flex-direction: column;
    align-items: center;
    color: var(--a-text-primary);
    font-family: var(--a-family-default);
    font-weight: var(--a-weight-base);
    letter-spacing: var(--a-letter-base);
    font-size: var(--a-type-large);
    line-height: var(--a-line-tall);
  }

  &__body {
    // For now. Later we may have better support for read-only areas
    // and array fields that allows clicking in to see more information
    // but carefully blocks editing
    pointer-events: none;
  }
}

.apos-doc-version-editor--compare {
  :deep(.apos-field__wrapper) {
    max-width: 100%;
    min-width: 150px;

    .apos-field {
      overflow-x: clip;
    }

    .apos-button__wrapper {
      display: none;
    }
  }

  :deep(.apos-input-array-inline-table) {
    max-width: 100%;

    th:empty {
      visibility: hidden;
      border: none;
    }

    .apos-input-array-inline-item-controls--remove {
      display: none;
    }

    .apos-slat__control--remove {
      display: none;
    }
  }

  :deep(.apos-input-relationship .apos-slat__main) {
    min-width: auto;
  }

  :deep(.apos-input-relationship__input-wrapper) {
    display: none;
  }

  .separator {
    align-self: center;
    width: 1px;
    height: 100vh;
    background-color: var(--a-base-9);
  }

  .apos-modal__rail--down {
    position: relative;
    top: 30px;
    height: calc(100vh - 129px);
    border-top: 1px solid var(--a-base-9);

    @include media-up(lap) {
      height: calc(100vh - 149px);
    }
  }
}

.apos-doc-version-editor--highlights-only {
  :deep(.apos-modal__main--with-rails) {
    grid-template-columns: 1fr minmax(250px, 22%);
  }

  :deep(.apos-field__wrapper) {
    display: none;
  }

  :deep(.apos-field__wrapper--highlight) {
    display: block;

    .apos-field__wrapper {
      display: block;
    }
  }
}

.apos-doc-version__view-options-menu__item {
  display: flex;
  flex-basis: 1;

  &__button {
    @include apos-button-reset();

    & {
      display: flex;
      gap: 20px;
      align-items: center;
      justify-content: space-between;
      cursor: pointer;
      width: 100%;
      padding: 10px 20px;
    }

    &:focus {
      outline: none;
      box-shadow: inset 0 0 0 1px var(--a-base-7);
    }
  }

  &__label {
    @include type-large;

    & {
      flex-grow: 1;
      max-width: 370px;
      line-height: var(--a-line-tallest);
      margin: 0;
    }
  }

  &--disabled {
    pointer-events: none;
  }

  &--disabled &__label {
    color: $input-color-disabled;
  }
}

.apos-doc-version__view-options-menu__item {
  &--disabled :deep(.apos-toggle__slider) {
    background-color: var(--a-base-7);
  }
}

.apos-doc-version-editor__compare {
  position: relative;
  top: -$spacing-double;
  left: -$spacing-quadruple;
  display: flex;
  width: calc(100% + ($spacing-quadruple * 2));
  height: 30px;
  font-size: var(--a-type-base);
  font-weight: var(--a-weight-base);

  &-header {
    @include type-base;

    & {
      display: flex;
      flex-basis: 50%;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      border-bottom: 1px solid var(--a-base-9);
    }
  }

  :deep(.apos-context-menu) {
    display: inline-flex;
    align-items: baseline;
    gap: 2px;
  }

  :deep(.apos-button) {
    border: none;
    background-color: transparent;
    text-decoration: none;
  }

  :deep(.apos-button:hover) {
    text-decoration: underline;
  }

  :deep(.apos-button:focus) {
    text-decoration: underline;
  }

  :deep(.apos-button__content) {
    flex-direction: row-reverse;
  }

  @include media-up(lap) {
    top: -$spacing-quadruple;
  }
}
</style>
