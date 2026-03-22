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
            ref="toolbarRef"
            :selected-state="selectAllState"
            :total-pages="0"
            :current-page="currentPage"
            :labels="moduleLabels"
            :displayed-items="items.length"
            :checked-count="checked.length"
            :batch-operations="batchOperations"
            :filter-values="batchFilterValues"
            :module-name="moduleName"
            :options="{ noPager: true }"
            @search="onSearch"
            @select-click="selectAll"
            @batch="handleBatchAction"
          />
          <AposDocsManagerSelectBox
            v-if="batchOperations.length"
            :selected-state="selectAllState"
            :module-labels="moduleLabels"
            :checked-ids="checked"
            :all-pieces-selection="allPiecesSelection"
            :displayed-items="items.length"
            @select-all="selectAllPieces"
            @set-all-pieces-selection="setAllPiecesSelection"
          />
          <div class="apos-recently-edited__filters-bar">
            <AposSpinner
              v-if="isLoading"
              class="apos-recently-edited__spinner"
            />
            <div
              v-if="activeFilterTags.length"
              class="apos-recently-edited__active-filters"
            >
              <AposRecentlyEditedFilterTag
                v-for="tag in activeFilterTags"
                :key="`${tag.name}:${tag.value ?? 'none'}`"
                :tag="tag"
                @clear="clearFilter"
              />
            </div>
            <AposRecentlyEditedFilters
              :filters="managerFilters"
              :filter-choices="filterChoices"
              :model-value="filterState"
              @update:model-value="updateFilters"
            />
          </div>
        </template>
        <template #bodyMain>
          <AposDocsManagerDisplay
            v-if="items.length > 0"
            v-model:checked="checked"
            :items="items"
            :headers="headers"
            :options="displayOptions"
            @open="editDoc"
          />
          <div
            v-else-if="!isLoading"
            class="apos-pieces-manager__empty"
          >
            <AposEmptyState :empty-state="emptyDisplay" />
            <div
              v-if="hasActiveSearch || hasActiveFilters"
              class="apos-recently-edited__clear-actions"
            >
              <button
                v-if="hasActiveSearch"
                type="button"
                class="apos-recently-edited__clear-all"
                @click="handleClearSearch"
              >
                {{ $t('apostrophe:recentlyEditedClearSearch') }}
              </button>
              <button
                v-if="hasActiveFilters"
                type="button"
                class="apos-recently-edited__clear-all"
                @click="clearAllFilters"
              >
                {{ $t('apostrophe:recentlyEditedClearAllFilters') }}
              </button>
            </div>
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
  computed, nextTick, onBeforeUnmount, onMounted, onUnmounted, ref, watch
} from 'vue';
import { useInfiniteScroll } from 'Modules/@apostrophecms/ui/composables/useInfiniteScroll.js';
import { useRecentlyEditedData } from '../composables/useRecentlyEditedData.js';

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

const scrollSentinel = ref(null);
const toolbarRef = ref(null);

const {
  moduleOptions,
  managerFilters,
  moduleLabels,
  emptyDisplay,
  items,
  currentPage,
  isLoading,
  isLoadingMore,
  filterChoices,
  filterState,
  activeFilterTags,
  crossLocale,
  reload,
  loadMore,
  updateFilters,
  clearFilter,
  clearAllFilters,
  hasActiveFilters,
  hasActiveSearch,
  clearSearch,
  onContentChanged,
  onSearch,
  cancel,
  batchOperations,
  batchFilterValues,
  checked,
  allPiecesSelection,
  selectAllState,
  selectAll,
  selectAllPieces,
  setAllPiecesSelection,
  handleBatchAction
} = useRecentlyEditedData(props.moduleName);

const {
  start: startScroll, stop: stopScroll, recheck
} = useInfiniteScroll(
  scrollSentinel,
  loadMore,
  {
    rootMargin: '100px',
    // Use the modal's actual scroll container, not the viewport.
    root: '.apos-modal__main'
  }
);

// After items change (page-1 reload or loadMore append), re-check
// sentinel visibility. Without this, IntersectionObserver won't fire
// again if the sentinel remained visible (e.g. low perPage and tall viewport).
watch(items, () => {
  nextTick(() => recheck());
});

const displayOptions = computed(() => ({
  ...moduleOptions.value,
  crossLocale: crossLocale.value,
  batchOperations: batchOperations.value
}));

const headers = [
  {
    label: 'apostrophe:title',
    name: 'title',
    component: 'AposCellTitle'
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

async function editDoc(item) {
  if (!item._edit) {
    return;
  }
  const docModuleName = item.slug?.startsWith('/')
    ? '@apostrophecms/page'
    : item.type;
  if (!apos.modules[docModuleName]) {
    return;
  }
  const editorComponent = apos.modules[docModuleName]?.components?.editorModal || 'AposDocEditor';
  const docLocale = item.aposLocale?.split(':')[0];

  await apos.modal.execute(editorComponent, {
    moduleName: docModuleName,
    docId: item._id,
    locale: docLocale
  });
}

function handleClearSearch() {
  clearSearch();
  if (toolbarRef.value) {
    toolbarRef.value.searchField.value = { data: '' };
  }
}

async function close() {
  modal.value.showModal = false;
}

onMounted(async () => {
  modal.value.active = true;
  await reload({ immediate: true });
  startScroll();
  apos.bus.$on('content-changed', onContentChanged);
  apos.bus.$on('command-menu-manager-close', close);
});

onBeforeUnmount(() => {
  cancel();
  stopScroll();
});

onUnmounted(() => {
  apos.bus.$off('content-changed', onContentChanged);
  apos.bus.$off('command-menu-manager-close', close);
});
</script>

<style lang="scss" scoped>

.apos-pieces-manager__empty {
  display: flex;
  flex-direction: column;
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

.apos-recently-edited__filters-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 12px;
}

.apos-recently-edited__spinner {
  margin-right: auto;
}

.apos-recently-edited__active-filters {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.apos-recently-edited__clear-actions {
  display: flex;
  gap: 16px;
  margin-top: 10px;
}

.apos-recently-edited__clear-all {
  @include type-base;

  & {
    padding: 0;
    border: none;
    color: var(--a-primary);
    background: none;
    cursor: pointer;
    text-decoration: underline;
  }

  &:hover {
    color: var(--a-primary-hover);
  }
}

</style>
