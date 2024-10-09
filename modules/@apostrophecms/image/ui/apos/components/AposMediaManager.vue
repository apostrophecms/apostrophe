<!--
  AposMediaManager will be in charge of all media-related state logic
  this includes doing the selecting and deselecting of items, deciding the editor/selection view,
  emitting batch action events, etc. All sub views will recieve `media` as a prop
-->

<template>
  <AposModal
    :modal="modal"
    :modal-title="modalTitle"
    class="apos-media-manager"
    @inactive="modal.active = false"
    @show-modal="modal.showModal = true"
    @esc="confirmAndCancel"
  >
    <template v-if="relationshipField" #secondaryControls>
      <AposButton
        type="default"
        label="apostrophe:cancel"
        @click="confirmAndCancel"
      />
    </template>
    <template v-else #secondaryControls>
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
      <AposModalBody v-else>
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
            :module-name="moduleName"
            :options="{noPager: true}"
            @select-click="selectClick"
            @search="search"
            @filter="filter"
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
            :options="{
              hideCheckboxes: !relationshipField
            }"
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
import { createId } from '@paralleldrive/cuid2';
import { debounceAsync } from 'Modules/@apostrophecms/ui/utils';
import AposModifiedMixin from 'Modules/@apostrophecms/ui/mixins/AposModifiedMixin';
import AposDocsManagerMixin from 'Modules/@apostrophecms/modal/mixins/AposDocsManagerMixin';

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
      loadRef: null,
      totalPages: 1,
      currentPage: 1,
      tagList: [],
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
      loadObserver: new IntersectionObserver(
        this.handleIntersect,
        {
          root: null,
          rootMargin: '30px',
          threshold: 0
        }
      )
    };
  },
  computed: {
    modalTitle () {
      let result;
      if (this.relationshipField) {
        result = {
          key: 'apostrophe:chooseDocType',
          type: this.$t(this.moduleLabels.pluralLabel)
        };
      } else {
        result = {
          key: 'apostrophe:manageDocType',
          type: this.$t(this.moduleLabels.pluralLabel)
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
        label: this.moduleOptions.label,
        pluralLabel: this.moduleOptions.pluralLabel
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
          typeLabel: this.$t(this.moduleLabels.label)
        };
      } else {
        return {
          key: 'apostrophe:selectManyLabel',
          typeLabel: this.$t(this.moduleLabels.pluralLabel)
        };
      }
    },
    isLastPage() {
      return this.totalPages > 1 && this.currentPage === this.totalPages;
    }
  },

  watch: {
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
    // Do these before any async work or they might get added after they are "removed"
    apos.bus.$on('content-changed', this.onContentChanged);
    apos.bus.$on('command-menu-manager-close', this.confirmAndCancel);
    await this.debouncedGetMedia.skipDelay({ tags: true });
    this.isFirstLoading = false;
  },

  beforeUnmount() {
    this.debouncedGetMedia.cancel();
    apos.bus.$off('content-changed', this.onContentChanged);
    apos.bus.$off('command-menu-manager-close', this.confirmAndCancel);
  },

  methods: {
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
      const apiResponse = (await apos.http.get(
        this.moduleOptions.action, {
          qs,
          draft: true
        }
      ));

      if (options.tags) {
        if (filtered) {
          // We never filter the tag list because they are presented like folders,
          // and folders don't disappear when empty. So we need to make a
          // separate query for distinct tags if our first query was filtered
          const apiResponse = (await apos.http.get(
            this.moduleOptions.action, {
              busy: true,
              qs: {
                choices: '_tags'
              },
              draft: true
            }
          ));
          result.tagList = apiResponse.choices._tags;
        } else {
          result.tagList = apiResponse.choices ? apiResponse.choices._tags : [];
        }
      }

      result.currentPage = apiResponse.currentPage;
      result.totalPages = apiResponse.pages;
      result.items = [];
      for (const image of apiResponse.results) {
        result.items.push(image);
      }
      return result;
    },
    async appendMedia({
      tagList, currentPage, totalPages, items
    }) {
      if (Array.isArray(tagList)) {
        this.tagList = tagList;
      }
      this.items = [];
      this.currentPage = currentPage;
      this.totalPages = totalPages;
      for (const item of items) {
        this.items.push(item);
      }
    },
    async refetchMedia(opts) {
      this.isLoading = true;
      this.currentPage = 1;
      this.items = [];
      await this.debouncedGetMedia.skipDelay(opts);
      this.isLoading = false;
      this.modified = false;
      this.updateEditing(null);
    },
    async filter(name, value) {
      this.filterValues[name] = value;
      this.refetchMedia();
    },
    createPlaceholder(dimensions) {
      this.items.unshift({
        _id: createId(),
        title: 'placeholder image',
        dimensions
      });
    },
    async completeUploading(imgIds) {
      this.currentPage = 1;
      this.items = [];
      await this.debouncedGetMedia.skipDelay();
      if (Array.isArray(imgIds) && imgIds.length && this.items.length === 0) {
        const [ widgetOptions = {} ] = apos.area.widgetOptions;
        const [ width, height ] = widgetOptions.minSize || [];
        await apos.notify('apostrophe:minSize', {
          type: 'danger',
          icon: 'alert-circle-icon',
          dismiss: true,
          interpolate: {
            width,
            height
          }
        });
        this.updateEditing(null);
        return;
      }
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
      const item = this.items.find(item => item._id === id);
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
      } else if (this.relationshipField && (this.relationshipField.max > 1 || !this.relationshipField.max)) {
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
      this.filterValues.autocomplete = value;
      this.currentPage = 1;
      this.items = [];
      this.isLoading = true;
      await this.debouncedGetMedia();
      this.isLoading = false;
    },

    async onContentChanged({ action, doc }) {
      if (doc.type !== '@apostrophecms/image' || ![ 'archive', 'update' ].includes(action)) {
        return;
      }

      this.modified = false;
      if (action === 'archive') {
        this.removeStateDoc(doc);
      }
      if (action === 'update') {
        this.updateStateDoc(doc);
      }

      await this.updateEditing(null);
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

    async handleIntersect(entries) {
      for (const entry of entries) {
        if (
          entry.isIntersecting &&
          this.currentPage < this.totalPages &&
          !this.isFirstLoading &&
          this.items.length
        ) {
          this.currentPage++;
          this.isScrollLoading = true;
          await this.$nextTick();
          this.loadRef.scrollIntoView({
            behavior: 'smooth'
          });
          await this.debouncedGetMedia.skipDelay();
          this.isScrollLoading = false;
        }
      }
    },
    observeLoadRef() {
      if (this.totalPages < 2) {
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
  margin-top: 130px;
}

.apos-media-manager__sidebar {
  position: relative;
  width: 100%;
}

.apos-media-manager__sidebar--empty {
  height: 100%;
}

</style>
