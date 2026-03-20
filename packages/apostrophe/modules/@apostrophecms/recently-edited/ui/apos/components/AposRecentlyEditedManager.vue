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
            :displayed-items="items.length"
            :checked-count="0"
            :batch-operations="[]"
            :module-name="moduleName"
            :options="{ noPager: true }"
            @search="onSearch"
          />
          <div class="apos-recently-edited__filters-bar">
            <div
              v-if="activeFilterTags.length"
              class="apos-recently-edited__active-filters"
            >
              <AposRecentlyEditedFilterTag
                v-for="tag in activeFilterTags"
                :key="tag.name"
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
            <button
              v-if="hasActiveFilters"
              type="button"
              class="apos-recently-edited__clear-all"
              @click="clearAllFilters"
            >
              {{ $t('apostrophe:recentlyEditedClearAllFilters') }}
            </button>
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
  onBeforeUnmount, onMounted, onUnmounted, ref
} from 'vue';
import { useInfiniteScroll } from 'Modules/@apostrophecms/ui/composables/useInfiniteScroll.js';
import { useRecentlyEditedData } from '../composables/useRecentlyEditedData.js';
import AposRecentlyEditedFilters from './AposRecentlyEditedFilters.vue';
import AposRecentlyEditedFilterTag from './AposRecentlyEditedFilterTag.vue';

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
  reload,
  loadMore,
  updateFilters,
  clearFilter,
  clearAllFilters,
  hasActiveFilters,
  onContentChanged,
  onSearch,
  cancel
} = useRecentlyEditedData(props.moduleName);

const { start: startScroll, stop: stopScroll } = useInfiniteScroll(
  scrollSentinel,
  loadMore,
  { rootMargin: '100px' }
);

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

async function editDoc(item) {
  const docModuleName = item.slug?.startsWith('/')
    ? '@apostrophecms/page'
    : item.type;
  const editorComponent = apos.modules[docModuleName]?.components?.editorModal || 'AposDocEditor';
  const docLocale = item.aposLocale?.split(':')[0];

  await apos.modal.execute(editorComponent, {
    moduleName: docModuleName,
    docId: item._id,
    locale: docLocale
  });
}

async function close() {
  modal.value.showModal = false;
}

onMounted(async () => {
  modal.value.active = true;
  await reload({ immediate: true });
  startScroll();
  apos.bus.$on('content-changed', onContentChanged);
});

onBeforeUnmount(() => {
  cancel();
  stopScroll();
});

onUnmounted(() => {
  apos.bus.$off('content-changed', onContentChanged);
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

.apos-recently-edited__active-filters {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.apos-recently-edited__clear-all {
  @include type-base;

  & {
    margin-top: 10px;
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
