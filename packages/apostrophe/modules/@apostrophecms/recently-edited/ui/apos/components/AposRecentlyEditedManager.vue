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
        <template #bodyHeader>
          <AposDocsManagerToolbar
            :selected-state="'empty'"
            :total-pages="0"
            :current-page="currentPage"
            :labels="moduleLabels"
            :displayed-items="0"
            :checked-count="0"
            :module-name="moduleName"
            :options="{ noPager: true }"
            @search="onSearch"
          />
        </template>
        <template #bodyMain>
          <AposDocsManagerDisplay
            v-if="items.length > 0"
            :items="items"
            :headers="headers"
            :options="moduleOptions"
            @open="editDoc"
          />
          <div
            v-else-if="!isLoading"
            class="apos-pieces-manager__empty"
          >
            <AposEmptyState :empty-state="emptyDisplay" />
          </div>
          <div
            ref="scrollSentinel"
            class="apos-recently-edited__sentinel"
          />
          <div
            v-if="isLoadingMore"
            class="apos-recently-edited__loading"
          >
            {{ $t('apostrophe:loadingMore') }}
          </div>
        </template>
      </AposModalBody>
    </template>
  </AposModal>
</template>

<script setup>
import {
  ref, computed, inject, onMounted, onBeforeUnmount, onUnmounted
} from 'vue';
import { debounceAsync } from 'Modules/@apostrophecms/ui/utils';

const $t = inject('i18n');

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

const moduleOptions = computed(() => apos.modules[props.moduleName]);

const moduleLabels = computed(() => ({
  singular: moduleOptions.value.label,
  plural: moduleOptions.value.pluralLabel
}));

const headers = [
  {
    label: 'apostrophe:title',
    name: 'title',
    component: 'AposCellButton'
  },
  {
    label: 'apostrophe:type',
    name: 'type',
    component: 'AposCellType'
  },
  {
    label: 'apostrophe:locale',
    name: '_localeLabel',
    component: 'AposCellBasic'
  },
  {
    label: 'apostrophe:lastEditor',
    name: '_lastEditor',
    component: 'AposCellBasic'
  },
  {
    label: 'apostrophe:lastEdited',
    name: 'updatedAt',
    component: 'AposCellLastEdited'
  }
];

const emptyDisplay = computed(() => ({
  icon: 'file-document-multiple-outline-icon',
  title: {
    key: 'apostrophe:recentlyEditedEmpty',
    count: moduleOptions.value.rollingWindowDays || 30
  }
}));

const items = ref([]);
const currentPage = ref(1);
const totalPages = ref(1);
const isLoading = ref(false);
const isLoadingMore = ref(false);
const scrollSentinel = ref(null);

let observer = null;
let loadGeneration = 0;

function formatLocale(aposLocale) {
  const code = aposLocale?.split(':')[0];
  const label = apos.i18n.locales[code]?.label;
  return label ? `${label} (${code})` : code;
}

function enrichItem(item) {
  const typeConfig = moduleOptions.value.managedTypes
    ?.find(t => t.name === item.type);
  return {
    ...item,
    title: item.title || $t(typeConfig?.label || item.type),
    _lastEditor: item.updatedBy?.title || item.updatedBy?.username || '',
    _localeLabel: formatLocale(item.aposLocale)
  };
}

// Pure fetch function — returns data, NO state mutations
async function fetchPage(page = 1) {
  const qs = {
    page
  };
  if (moduleOptions.value.managerApiProjection) {
    qs.project = moduleOptions.value.managerApiProjection;
  }
  return apos.http.get(moduleOptions.value.action, {
    qs,
    busy: page === 1,
    draft: true
  });
}

// State mutation — onSuccess callback only
function applyPage1Results(response) {
  loadGeneration++;
  items.value = (response.results || []).map(enrichItem);
  currentPage.value = response.currentPage;
  totalPages.value = response.pages;
  isLoading.value = false;
}

const DEBOUNCE_TIMEOUT = 300;

const debouncedLoad = debounceAsync(
  () => fetchPage(1),
  DEBOUNCE_TIMEOUT,
  { onSuccess: applyPage1Results }
);

function setupInfiniteScroll() {
  observer = new IntersectionObserver(handleIntersect, {
    root: null,
    rootMargin: '100px',
    threshold: 0
  });
  if (scrollSentinel.value) {
    observer.observe(scrollSentinel.value);
  }
}

async function handleIntersect(entries) {
  const entry = entries[0];
  if (
    entry.isIntersecting &&
    !isLoadingMore.value &&
    currentPage.value < totalPages.value
  ) {
    await loadMore();
  }
}

async function loadMore() {
  if (isLoadingMore.value || currentPage.value >= totalPages.value) {
    return;
  }
  const gen = loadGeneration;
  isLoadingMore.value = true;
  try {
    const response = await fetchPage(currentPage.value + 1);
    if (gen !== loadGeneration) {
      return;
    }
    items.value = [
      ...items.value,
      ...(response.results || []).map(enrichItem)
    ];
    currentPage.value = response.currentPage;
    totalPages.value = response.pages;
  } finally {
    isLoadingMore.value = false;
  }
}

function onContentChanged() {
  debouncedLoad.skipDelay();
}

function onSearch(query) {
  // Search will be wired in Phase 4
}

async function editDoc(item) {
  const moduleName = item.slug?.startsWith('/')
    ? '@apostrophecms/page'
    : item.type;
  const editorComponent = apos.modules[moduleName]?.components?.editorModal || 'AposDocEditor';
  await apos.modal.execute(editorComponent, {
    moduleName,
    docId: item._id
  });
}

async function close() {
  modal.value.showModal = false;
}

onMounted(async () => {
  modal.value.active = true;
  isLoading.value = true;
  await debouncedLoad.skipDelay();
  setupInfiniteScroll();
  apos.bus.$on('content-changed', onContentChanged);
});

onBeforeUnmount(() => {
  debouncedLoad.cancel();
  if (observer) {
    observer.disconnect();
  }
});

onUnmounted(() => {
  apos.bus.$off('content-changed', onContentChanged);
});
</script>

<style lang="scss" scoped>
.apos-pieces-manager__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

.apos-recently-edited__sentinel {
  height: 1px;
}

.apos-recently-edited__loading {
  padding: 10px 20px;
  color: var(--a-base-4);
  font-size: var(--a-type-small);
  text-align: center;
}

</style>
