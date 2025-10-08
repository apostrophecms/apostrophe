<template>
  <AposModal
    :modal="modal"
    :modal-title="modalTitle"
    class="apos-media-manager"
    @inactive="modal.active = false"
    @show-modal="modal.showModal = true"
    @esc="confirmAndCancel"
  >
    <template
      v-if="relationshipField"
      #secondaryControls
    >
      <AposButton
        type="default"
        label="apostrophe:cancel"
        @click="confirmAndCancel"
      />
    </template>
    <template
      v-else
      #secondaryControls
    >
      <AposButton
        type="default"
        label="apostrophe:exit"
        @click="confirmAndCancel"
      />
    </template>
    <template #primaryControls>
      <AposUtilityOperations
        :module-options="moduleOptions"
        :has-relationship-field="!!relationshipField"
      />
      <AposButton
        v-if="relationshipField"
        type="primary"
        :label="saveRelationshipLabel"
        :disabled="!!relationshipErrors"
        :attrs="{'data-apos-focus-priority': true}"
        @click="saveRelationship"
      />
    </template>
    <template #leftRail>
      <AposModalRail>
        <AposTagList
          title="apostrophe:filterByTag"
          :tags="tagList"
          @update="filter('_tags', $event)"
        />
      </AposModalRail>
    </template>
    <template #main>
      <AposLoadingBlock v-if="isFirstLoading" />
      <AposModalBody
        v-else
        ref="modalBody"
      >
        <template #bodyHeader>
          <AposDocsManagerToolbar
            :selected-state="selectAllState"
            :total-pages="totalPages"
            :current-page="currentPage"
            :filters="toolbarFilters"
            :filter-values="filterValues"
            :labels="moduleLabels"
            :disable="relationshipErrors === 'min'"
            :displayed-items="items.length"
            :checked="checked"
            :checked-count="checked.length"
            :checked-docs-tags="checkedDocsTags"
            :module-name="moduleName"
            :options="{noPager: true}"
            :batch-operations="moduleOptions.batchOperations"
            :batch-tags="batchTags"
            @select-click="selectClick"
            @search="search"
            @filter="filter"
            @batch="handleBatchAction"
            @refresh-data="refreshData"
          />
        </template>
        <template #bodyMain>
          <AposLoadingBlock v-if="isLoading" />
          <AposMediaManagerDisplay
            v-else
            ref="display"
            v-model:checked="checked"
            :accept="accept"
            :items="items"
            :module-options="moduleOptions"
            :max-reached="maxReached()"
            :is-last-page="isLastPage"
            :relationship-field="relationshipField"
            :is-scroll-loading="isScrollLoading"
            @edit="updateEditing"
            @select="select"
            @select-series="selectSeries"
            @select-another="selectAnother"
            @upload-complete="completeUploading"
            @create-placeholder="createPlaceholder"
            @set-load-ref="setLoadRef"
          />
        </template>
      </AposModalBody>
    </template>
    <template #rightRail>
      <AposModalRail type="right">
        <div
          class="apos-media-manager__sidebar"
          :class="{ 'apos-media-manager__sidebar--empty' : !checked.length }"
        >
          <AposMediaManagerEditor
            v-show="editing"
            :media="editing"
            :is-modified="isModified"
            :module-labels="moduleLabels"
            @back="updateEditing(null)"
            @modified="editorModified"
          />
          <AposMediaManagerSelections
            v-show="!editing"
            :items="checkedDocs"
            @clear="clearSelected"
            @edit="updateEditing"
          />
        </div>
      </AposModalRail>
    </template>
  </AposModal>
</template>

<script>
import { debounceAsync, asyncTaskQueue } from 'Modules/@apostrophecms/ui/utils';
import AposModifiedMixin from 'Modules/@apostrophecms/ui/mixins/AposModifiedMixin';
import AposDocsManagerMixin from 'Modules/@apostrophecms/modal/mixins/AposDocsManagerMixin';
import { computeMinSizes } from 'apostrophe/lib/image.js';

const DEBOUNCE_TIMEOUT = 500;

export default {
  mixins: [ AposModifiedMixin, AposDocsManagerMixin ],
  props: {
    moduleName: {
      type: String,
      required: true
    }
  },
  emits: [ 'archive', 'save', 'search', 'piece-relationship-query' ],
  data() {
    return {
      items: [],
      isFirstLoading: true,
      isLoading: false,
      isScrollLoading: false,
      skipLoadObserver: false,
      lock: 0,
      loadRef: null,
      totalPages: 1,
      currentPage: 1,
      tagList: [],
      batchTags: [],
      filterValues: {},
      modal: {
        active: false,
        type: 'overlay',
        showModal: false
      },
      editing: undefined,
      modified: false,
      lastSelected: null,
      emptyDisplay: {
        title: 'apostrophe:noMediaFound',
        message: 'apostrophe:uploadedMediaPlaceholder',
        emoji: '🖼'
      },
      cancelDescription: 'apostrophe:discardImageChangesPrompt',
      debouncedGetMedia: debounceAsync(this.getMedia, DEBOUNCE_TIMEOUT, {
        onSuccess: this.appendMedia
      }),
      scrollQueue: asyncTaskQueue(),
      loadObserver: new IntersectionObserver(
        this.handleIntersect,
        {
          root: null,
          rootMargin: '30px',
          threshold: 0
        }
      ),
      // A flag to indicate if the upload was triggered by the user.
      // If true, it'll enable additional logic to avoid duplicate items
      // when infinite scrolling.
      uploaded: false
    };
  },
  computed: {
    modalTitle () {
      let result;
      if (this.relationshipField) {
        result = {
          key: 'apostrophe:chooseDocType',
          type: this.$t(this.moduleLabels.plural)
        };
      } else {
        result = {
          key: 'apostrophe:manageDocType',
          type: this.$t(this.moduleLabels.plural)
        };
      }
      return result;
    },
    moduleOptions() {
      return window.apos.modules[this.moduleName];
    },
    toolbarFilters() {
      if (!this.moduleOptions || !this.moduleOptions.filters) {
        return null;
      }

      return this.moduleOptions.filters.filter(filter => {
        // Removes _tags since that will be in the left sidebar.
        return filter.name !== '_tags';
      });
    },
    moduleLabels() {
      if (!this.moduleOptions) {
        return null;
      }
      return {
        singular: this.moduleOptions.label,
        plural: this.moduleOptions.pluralLabel
      };
    },
    accept() {
      return this.moduleOptions.schema.find(field => field.name === 'attachment').accept;
    },
    // Whether a cancellation requires confirmation or not
    isModified () {
      return (this.editing && this.modified) || this.relationshipIsModified();
    },
    headers() {
      // Satisfy mixin requirement not actually applicable here
      return [];
    },
    saveRelationshipLabel() {
      if (this.relationshipField && (this.relationshipField.max === 1)) {
        return {
          key: 'apostrophe:selectOneLabel',
          typeLabel: this.$t(this.moduleLabels.singular)
        };
      } else {
        return {
          key: 'apostrophe:selectManyLabel',
          typeLabel: this.$t(this.moduleLabels.plural)
        };
      }
    },
    isLastPage() {
      return this.totalPages > 1 &&
        this.currentPage === this.totalPages &&
        !this.isScrollLoading;
    },
    checkedDocsTags() {
      return Object.fromEntries(this.checkedDocs.map(doc => [ doc._id, doc.tagsIds ]));
    }
  },

  watch: {
    // Reset uploaded flag when the item state is reset.
    items(newVal) {
      if (newVal.length === 0) {
        this.uploaded = false;
      }
    },
    async checked (newVal, oldVal) {
      this.lastSelected = newVal.at(-1);
      if (newVal.length > 1 || newVal.length === 0) {
        if (
          !this.checked.includes(this.editing?._id) &&
          oldVal.includes(this.editing?._id) &&
          !await this.updateEditing(null)
        ) {
          this.checked = oldVal;
        }

        if (this.modified === false) {
          await this.updateEditing(null);
        }

        return;
      }

      await this.updateEditing(newVal.at(0));
    },
    isLastPage(newVal) {
      if (newVal) {
        this.disconnectObserver();
      }
    }
  },

  created() {
    this.setDefaultFilters();
  },

  async mounted() {
    this.modal.active = true;
    // Do these before any async work or they might get added after they are
    // "removed"
    apos.bus.$on('content-changed', this.onContentChanged);
    apos.bus.$on('command-menu-manager-close', this.confirmAndCancel);

    // Load the first page of media, no debounce.
    await this.scrollQueue.add(async () => {
      const result = await this.getMedia({ tags: true });
      await this.appendMedia(result);
      this.isFirstLoading = false;
    });

    await this.getTags();
  },

  beforeUnmount() {
    this.debouncedGetMedia.cancel();
    apos.bus.$off('content-changed', this.onContentChanged);
    apos.bus.$off('command-menu-manager-close', this.confirmAndCancel);
  },

  methods: {
    hasScroll() {
      const gridHeight = this.$refs.display?.$el?.offsetHeight;
      const containerHeight = this.$refs.modalBody?.getBodyMainRef()?.offsetHeight;
      return gridHeight > containerHeight;
    },
    setDefaultFilters() {
      this.moduleOptions.filters.forEach(filter => {
        this.filterValues[filter.name] = filter.def;
      });
    },
    // Update our current idea of whether the doc in the right hand rail
    // has been modified (via event from the editor)
    editorModified (val) {
      this.modified = val;
    },
    async getMedia(options = {}) {
      const result = {};
      const qs = {
        ...this.filterValues,
        page: this.currentPage,
        viewContext: this.relationshipField ? 'relationship' : 'manage'
      };

      // Used for batch tagging update
      if (options._ids) {
        qs._ids = options._ids;
        qs.perPage = options._ids.length;
        qs.page = 1;
      }

      const filtered = !!Object.keys(this.filterValues).length;
      if (this.moduleOptions && Array.isArray(this.moduleOptions.filters)) {
        this.moduleOptions.filters.forEach(filter => {
          if (!filter.choices && qs.choices) {
            qs.choices += `,${filter.name}`;
          } else if (!filter.choices) {
            qs.choices = filter.name;
          }
        });
      }

      if (this.relationshipField) {
        apos.bus.$emit('piece-relationship-query', qs);
      }

      // Avoid undefined properties.
      for (const prop in qs) {
        if (qs[prop] === undefined) {
          delete qs[prop];
        };
      }
      const apiResponse = await apos.http.post(this.moduleOptions.action, {
        body: {
          __aposGetWithQuery: qs
        },
        draft: true
      });

      if (options.tags) {
        if (filtered) {
          // We never filter the tag list because they are presented like
          // folders, and folders don't disappear when empty. So we need to make
          // a separate query for distinct tags if our first query was filtered
          const tagApiResponse = await apos.http.get(this.moduleOptions.action, {
            busy: true,
            qs: {
              choices: '_tags',
              // Don't get useless data (minimimum per page is 1)
              perPage: 1,
              project: { title: 1 }
            },
            draft: true
          });
          result.tagList = tagApiResponse.choices._tags;
        } else {
          result.tagList = apiResponse.choices ? apiResponse.choices._tags : [];
        }
      }

      result.options = options;
      result.currentPage = apiResponse.currentPage;
      result.totalPages = apiResponse.pages;
      result.items = [];
      for (const image of apiResponse.results) {
        result.items.push(image);
      }
      return result;
    },
    async appendMedia({
      tagList, currentPage, totalPages, items, options = {}
    }) {
      if (typeof options.lock === 'number' && options.lock !== this.lock) {
        return;
      }
      if (Array.isArray(tagList)) {
        this.tagList = tagList;
      }
      this.currentPage = currentPage;
      this.totalPages = totalPages;
      // Do not perform extra work if not needed
      const skipIds = options.loadMoreIfSkipped && !options.loadMore
        ? new Set(this.items.map(item => item._id))
        : new Set();

      let skipped = 0;
      for (const item of items) {
        if (skipIds.has(item._id)) {
          skipped++;
          continue;
        }
        this.items.push(item);
      }

      // In effect when resetting the state (e.g. search) and we want to
      // load items until the scroll is available.
      if (options.loadMore) {
        this.isLoading = false;
        await this.$nextTick();
        await this.loadUntilScroll(options.lock);
      } else if (options.loadMoreIfSkipped && skipped > 0) {
        // In effect after an upload and when the user scrolls down.
        // We want to load more items if we skipped some due to duplicates
        // (items that were added to the list without being requested from
        // the server index route).
        // This ensures that the inifinite scroll will work as expected.
        await this.loadWhenIntersecting(options.lock);
      }

      return skipped;
    },
    async refetchMedia(opts) {
      this.isLoading = true;
      this.currentPage = 1;
      this.items = [];
      await this.debouncedGetMedia.skipDelay(opts);
      this.isLoading = false;
      this.modified = false;
      this.clearSelected();
    },
    async filter(name, value) {
      this.filterValues[name] = value;
      this.refetchMedia();
    },
    createPlaceholder(piece) {
      this.items.unshift(piece);
    },
    async completeUploading(images) {
      this.uploaded = true;
      const [ widgetOptions = {} ] = apos.area.widgetOptions;

      let uploaded = [];

      if (!widgetOptions.minSize) {
        uploaded = images;
      } else {
        // Filter out images that are too small
        const { minWidth, minHeight } = computeMinSizes(
          widgetOptions.minSize,
          widgetOptions.aspectRatio
        );

        let minSizeError = false;

        for (const image of images) {
          const imageWidth = image.attachment?.width;
          const imageHeight = image.attachment?.height;

          if (imageWidth < minWidth || imageHeight < minHeight) {
            minSizeError = true;
            if (this.editing?._id === image._id) {
              this.updateEditing(null);
            }
            continue;
          }

          uploaded.push(image);
        }

        if (minSizeError) {
          await apos.notify('apostrophe:minSize', {
            type: 'danger',
            icon: 'alert-circle-icon',
            dismiss: true,
            interpolate: {
              width: Math.round(minWidth),
              height: Math.round(minHeight)
            }
          });
        }
      }

      const imgIds = uploaded.map(image => image._id);

      this.items = this.items.map(item => {
        if (!item.__placeholder) {
          return item;
        }
        return uploaded.shift();
      })
        .filter(image => (!!image && !image.__placeholder));

      if (Array.isArray(imgIds) && imgIds.length) {
        const checked = this.checked.concat(imgIds);
        this.checked = checked.slice(0, this.relationshipField?.max || checked.length);

        // If we're currently editing one, don't interrupt that by replacing it.
        if (!this.editing && imgIds.length === 1) {
          this.updateEditing(imgIds[0]);
        }
      }
    },
    clearSelected() {
      this.checked = [];
    },
    async updateEditing(id) {
      let item = this.items.find(item => item._id === id);
      if (!item) {
        item = this.checkedDocs.find(item => item._id === id);
      }
      // We only care about the current doc for this prompt,
      // we are not in danger of discarding a selection when
      // we switch images
      if (this.editing && this.modified) {
        const discard = await apos.confirm({
          heading: this.cancelHeading,
          description: this.cancelDescription,
          negativeLabel: this.cancelNegativeLabel,
          affirmativeLabel: this.cancelAffirmativeLabel
        });
        if (!discard) {
          return false;
        }
      }
      if (!item?._edit) {
        this.editing = null;
        return true;
      }
      this.editing = item;
      return true;
    },
    // select setters
    select(id) {
      if (this.checked.includes(id)) {
        this.updateEditing(id);
      } else if (
        this.relationshipField &&
        (this.relationshipField.max > 1 || !this.relationshipField.max)
      ) {
        this.selectAnother(id);
      } else {
        this.checked = [ id ];
      }
    },
    selectAnother(id) {
      if (this.relationshipField?.max === 1) {
        this.select(id);
        return;
      }
      if (this.checked.includes(id)) {
        this.checked = this.checked.filter(checkedId => checkedId !== id);
      } else {
        this.checked = [ ...this.checked, id ];
      }
    },
    selectSeries(id) {
      if (!this.lastSelected || this.relationshipField?.max === 1) {
        this.select(id);
        return;
      }

      const beginIndex = this.items.findIndex(item => item._id === this.lastSelected);
      const endIndex = this.items.findIndex(item => item._id === id);
      const direction = beginIndex > endIndex ? -1 : 1;

      const start = direction < 0 ? endIndex : beginIndex;
      const end = direction < 0 ? beginIndex : endIndex + 1;
      const imgIds = this.items
        .slice(start, end)
        .map(item => item._id)
        .filter(_id => !this.checked.includes(_id));

      const checked = this.checked.concat(imgIds);
      this.checked = checked.slice(0, this.relationshipField?.max || checked.length);
    },

    // Toolbar handlers
    async selectClick() {
      if (await this.updateEditing(null)) {
        this.selectAll();
      }
    },
    archiveClick() {
      this.$emit('archive', this.checked);
    },

    async search(value) {
      this.lock++;
      this.skipLoadObserver = true;
      this.filterValues.autocomplete = value;
      this.currentPage = 1;
      this.items = [];
      this.isLoading = true;
      await this.debouncedGetMedia({
        loadMore: true,
        lock: this.lock
      });
      this.isLoading = false;
      this.skipLoadObserver = false;
    },
    async onContentChanged({
      action, doc, docIds, docTypes
    }) {
      const types = this.getContentChangedTypes(doc, docTypes);
      if (!types.includes(this.moduleName)) {
        return;
      }

      if (docIds && action === 'tag') {
        await this.refreshData(docIds);
        return;
      }

      this.modified = false;
      if (action === 'update') {
        this.updateStateDoc(doc);
      } else {
        this.refetchMedia();
      }
      await this.updateEditing(null);
    },

    async refreshData(docIds) {
      const { items: updatedImages, tagList } = await this.getMedia({
        ...docIds && { _ids: docIds },
        tags: true
      });
      updatedImages.forEach(this.updateStateDoc);

      await this.getTags();
      if (Array.isArray(tagList)) {
        this.tagList = tagList;
      }

      await this.updateEditing(null);

      // If we were editing one, replacing it.
      if (this.editing && updatedImages.length === 1) {
        this.modified = false;
        // Needed to refresh the AposMediaManagerEditor
        await this.$nextTick();
        await this.updateEditing(updatedImages.at(0)._id);
      }
    },

    updateStateDoc(doc) {
      const index = this.items.findIndex(item => item._id === doc._id);
      const checkedIndex = this.checkedDocs
        .findIndex(checkedDoc => checkedDoc._id === doc._id);
      if (index !== -1) {
        this.items[index] = doc;
      }
      if (checkedIndex !== -1) {
        this.checkedDocs[checkedIndex] = doc;
      }
    },

    // Keep it for later when we will be able to udpate the UI without
    // refreshing existing because it would break pagination.
    removeStateDoc(doc) {
      const index = this.items.findIndex(item => item._id === doc._id);
      const checkedIndex = this.checked.findIndex(checkedId => checkedId === doc._id);
      const checkedDocsIndex = this.checkedDocs.findIndex(({ _id }) => _id === doc._id);

      if (index !== -1) {
        this.items.splice(index, 1);
      }
      if (checkedIndex !== -1) {
        this.checked.splice(checkedIndex, 1);
      }
      if (checkedDocsIndex !== -1) {
        this.checkedDocs.splice(checkedDocsIndex, 1);
      }
    },

    async loadUntilScroll(lock) {
      let attempts = 0;
      let shouldLoad = true;
      while (!this.hasScroll() && shouldLoad && attempts < 20) {
        shouldLoad = await this.loadWhenIntersecting(lock);
        attempts++;
        await this.$nextTick();
      }
    },
    async handleIntersect(entries) {
      for (const entry of entries) {
        if (
          entry.isIntersecting &&
          !this.isFirstLoading &&
          !this.skipLoadObserver
        ) {
          this.scrollQueue.add(async () => {
            await this.loadWhenIntersecting();
            await this.$nextTick();
            await this.loadUntilScroll();
          // eslint-disable-next-line no-console
          }).catch(console.error);
        }
      }
    },
    async loadWhenIntersecting(lock) {
      if (
        this.currentPage < this.totalPages &&
        this.items.length
      ) {
        this.currentPage++;
        this.isScrollLoading = true;
        const result = await this.getMedia({
          lock,
          // Tell the load handler to request more items if it finds
          // duplicates in the response, only after an upload.
          loadMoreIfSkipped: this.uploaded
        });
        // Not efficient, the currentPage is already incremented.
        // We can't revert it because we don't know what happened meanwhile.
        // This is an architectural issue and a source of racing conditions.
        // It can be fixed only by mass refactoring at the right time in
        // the future.
        if (typeof lock === 'number' && lock !== this.lock) {
          this.isScrollLoading = false;
          return false;
        }
        await this.appendMedia(result);
        this.isScrollLoading = false;

        return true;
      }

      return false;
    },
    observeLoadRef() {
      if (this.totalPages < 2 || !this.loadRef) {
        return;
      }

      this.loadObserver.observe(this.loadRef);
    },
    disconnectObserver() {
      if (this.loadObserver) {
        this.loadObserver.disconnect();
      }
    },
    setLoadRef(ref) {
      this.loadRef = ref;
      this.disconnectObserver();
      if (ref) {
        this.observeLoadRef();
      }
    },
    async handleBatchAction({
      label, action, requestOptions = {}, messages
    }) {
      if (action) {
        try {
          await apos.http.post(`${this.moduleOptions.action}/${action}`, {
            body: {
              ...requestOptions,
              _ids: this.checked,
              messages,
              type: this.checked.length === 1
                ? this.moduleLabels.singular
                : this.moduleLabels.plural
            }
          });
        } catch (error) {
          apos.notify('apostrophe:errorBatchOperationNoti', {
            interpolate: { operation: this.$t(label) },
            type: 'danger'
          });
        }
      }
    },
    async getTags() {
      try {
        const { withType = '@apostrophecms/image-tag' } = this.moduleOptions.schema.find(field => field._name === '_tags') || {};
        const action = apos.modules[withType]?.action;
        if (!action) {
          return [];
        }

        const response = await apos.http.get(
          action,
          {
            draft: true,
            qs: {
              sort: {
                title: 1
              }
            }
          }
        );

        const tags = (response.results || []).map(tag => {
          return {
            ...tag,
            searchText: tag.title.toLowerCase(),
            label: tag.title
          };
        });

        this.batchTags = tags;
      } catch (error) {
        // TODO: notify message
        apos.notify(error.message);
      }
    }
  }
};
</script>

<style lang="scss" scoped>
.apos-media-manager {
  :deep(.apos-modal__body) {
    padding: 0;
  }

  :deep(.apos-modal__body-inner) {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  :deep(.apos-modal__body-header) {
    padding: $spacing-double $spacing-double 20px;

    @include media-up(lap) {
      padding: $spacing-quadruple $spacing-quadruple 20px;
    }
  }

  :deep(.apos-modal__body-main) {
    overflow-y: auto;
    box-sizing: border-box;
    padding: 0 $spacing-double 20px;

    @include media-up(lap) {
      padding: 0 $spacing-quadruple 20px;
    }
  }
}

.apos-media-manager__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

.apos-media-manager__sidebar {
  position: relative;
  width: 100%;
}

.apos-media-manager__sidebar--empty {
  height: 100%;
}

</style>
