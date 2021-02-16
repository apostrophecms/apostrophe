<!--
  AposMediaManager will be in charge of all media-related state logic
  this includes doing the selecting and deselecting of items, deciding the editor/selection view,
  emitting batch action events, etc. All sub views will recieve `media` as a prop
-->

<template>
  <AposModal
    :modal="modal" :modal-title="modalTitle"
    class="apos-media-manager"
    @inactive="modal.active = false" @show-modal="modal.showModal = true"
    @esc="confirmAndCancel" @no-modal="$emit('safe-close')"
  >
    <template v-if="relationshipField" #secondaryControls>
      <AposButton
        type="default" label="Cancel"
        @click="confirmAndCancel"
      />
    </template>
    <template v-else #secondaryControls>
      <AposButton
        type="default" label="Exit"
        @click="confirmAndCancel"
      />
    </template>
    <template v-if="relationshipField" #primaryControls>
      <AposButton
        type="primary"
        :label="`Select ${moduleLabels.pluralLabel || ''}`"
        :disabled="relationshipErrors"
        @click="saveRelationship"
      />
    </template>
    <template #leftRail>
      <AposModalRail>
        <AposTagList
          title="Filter by Tag"
          :tags="tagList"
          @update="filter('_tags', $event)"
        />
      </AposModalRail>
    </template>
    <template #main>
      <AposModalBody>
        <template #bodyHeader>
          <AposDocsManagerToolbar
            :selected-state="selectAllState"
            :total-pages="totalPages" :current-page="currentPage"
            :filters="toolbarFilters" :labels="moduleLabels"
            :disable="relationshipErrors === 'min'"
            :options="{ hideSelectAll: !relationshipField }"
            @page-change="updatePage"
            @select-click="selectClick"
            @trash-click="trashClick"
            @search="search"
            @filter="filter"
          />
        </template>
        <template #bodyMain>
          <AposMediaManagerDisplay
            ref="display"
            :accept="accept"
            :items="items"
            :module-options="options"
            @edit="updateEditing"
            v-model="checked"
            @select="select"
            @select-series="selectSeries"
            @select-another="selectAnother"
            @upload-started="uploading = true"
            @upload-complete="completeUploading"
            @create-placeholder="createPlaceholder"
            :max-reached="maxReached()"
            :options="{
              disableUnchecked: maxReached(),
              hideCheckboxes: !relationshipField
            }"
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
            :media="editing" :selected="selected"
            :module-labels="moduleLabels"
            @back="updateEditing(null)" @saved="updateMedia"
            @modified="editorModified"
          />
          <AposMediaManagerSelections
            :items="selected"
            @clear="clearSelected" @edit="updateEditing"
            v-show="!editing"
          />
        </div>
      </AposModalRail>
    </template>
  </AposModal>
</template>

<script>
import AposModalModifiedMixin from 'Modules/@apostrophecms/modal/mixins/AposModalModifiedMixin';
import AposDocsManagerMixin from 'Modules/@apostrophecms/modal/mixins/AposDocsManagerMixin';
import cuid from 'cuid';
export default {
  mixins: [ AposModalModifiedMixin, AposDocsManagerMixin ],
  props: {
    moduleName: {
      type: String,
      required: true
    }
  },
  emits: [ 'safe-close', 'trash', 'save', 'search' ],
  data() {
    return {
      items: [],
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
      uploading: false,
      lastSelected: null,
      emptyDisplay: {
        title: 'No Media Found',
        message: 'Uploaded media will appear here',
        emoji: '🖼'
      },
      cancelDescription: 'Do you want to discard changes to the active image?'
    };
  },
  computed: {
    modalTitle () {
      const verb = this.relationshipField ? 'Choose' : 'Manage';
      return `${verb} ${this.moduleLabels.pluralLabel}`;
    },
    options() {
      return window.apos.modules[this.moduleName];
    },
    toolbarFilters() {
      if (!this.options || !this.options.filters) {
        return null;
      }
      return this.options.filters.filter(filter => {
        // Removes _tags since that will be in the left sidebar.
        return filter.name !== '_tags';
      });
    },
    moduleLabels() {
      if (!this.options) {
        return null;
      }
      return {
        label: this.options.label,
        pluralLabel: this.options.pluralLabel
      };
    },
    selected() {
      return this.items.filter(item => this.checked.includes(item._id));
    },
    accept() {
      return this.options.schema.find(field => field.name === 'attachment').accept;
    },
    // Whether a cancellation requires confirmation or not
    isModified () {
      return (this.editing && this.modified) || this.relationshipIsModified();
    }
  },
  watch: {
    async checked (newVal, oldVal) {
      if (newVal.length > 1 || newVal.length === 0) {
        if (!await this.updateEditing(null)) {
          this.checked = oldVal;
        }
      }
    }
  },
  async mounted() {
    this.modal.active = true;
    await this.getMedia({ tags: true });
    apos.bus.$on('content-changed', this.onContentChanged);
  },
  destroyed() {
    apos.bus.$off('content-changed', this.onContentChanged);
  },
  methods: {
    // Update our current idea of whether the doc in the right hand rail
    // has been modified (via event from the editor)
    editorModified (val) {
      this.modified = val;
    },
    async getMedia (options) {
      const qs = {
        ...this.filterValues,
        page: this.currentPage
      };
      const filtered = !!Object.keys(this.filterValues).length;
      if (this.options && Array.isArray(this.options.filters)) {
        this.options.filters.forEach(filter => {
          if (!filter.choices && qs.choices) {
            qs.choices += `,${filter.name}`;
          } else if (!filter.choices) {
            qs.choices = filter.name;
          }
        });
      }
      // Avoid undefined properties.
      for (const prop in qs) {
        if (qs[prop] === undefined) {
          delete qs[prop];
        };
      }
      const apiResponse = (await apos.http.get(
        this.options.action, {
          busy: true,
          qs,
          draft: true
        }
      ));
      if (options && options.tags) {
        if (filtered) {
          // We never filter the tag list because they are presented like folders,
          // and folders don't disappear when empty. So we need to make a
          // separate query for distinct tags if our first query was filtered
          const apiResponse = (await apos.http.get(
            this.options.action, {
              busy: true,
              qs: {
                choices: '_tags'
              },
              draft: true
            }
          ));
          this.tagList = apiResponse.choices._tags;
        } else {
          this.tagList = apiResponse.choices ? apiResponse.choices._tags : [];
        }
      }
      this.currentPage = apiResponse.currentPage;
      this.totalPages = apiResponse.pages;
      this.items = apiResponse.results;
    },
    async updateMedia () {
      this.updateEditing(null);
      await this.getMedia();
    },
    async filter(name, value) {
      this.filterValues[name] = value;
      this.currentPage = 1;
      await this.getMedia();
    },
    createPlaceholder(dimensions) {
      this.items.unshift({
        _id: cuid(),
        title: 'placeholder image',
        dimensions
      });
    },
    async completeUploading (imgIds) {
      this.uploading = false;
      await this.getMedia();
      if (Array.isArray(imgIds) && imgIds.length) {
        this.checked = this.checked.concat(imgIds);
        // If we're currently editing one, don't interrupt that by replacing it.
        if (!this.editing && imgIds.length === 1) {
          this.updateEditing(imgIds[0]);
        }
      }
    },
    clearSelected() {
      this.checked = [];
      this.editing = undefined;
    },
    async updateEditing(id) {
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
      this.editing = this.items.find(item => item._id === id);
      return true;
    },
    // select setters
    select(id) {
      if (this.checked.includes(id)) {
        this.checked = [];
      } else {
        this.checked = [ id ];
      }
      this.updateEditing(id);
      this.lastSelected = id;
    },
    selectAnother(id) {
      if (this.checked.includes(id)) {
        this.checked = this.checked.filter(checkedId => checkedId !== id);
      } else {
        this.checked.push(id);
      }
      this.lastSelected = id;
      this.editing = undefined;
    },
    selectSeries(id) {
      if (!this.lastSelected) {
        this.select(id);
        return;
      }
      let beginIndex = this.items.findIndex(item => item._id === this.lastSelected);
      let endIndex = this.items.findIndex(item => item._id === id);
      const direction = beginIndex > endIndex ? -1 : 1;
      if (direction < 0) {
        [ beginIndex, endIndex ] = [ endIndex, beginIndex ];
      } else {
        endIndex++;
      }
      const sliced = this.items.slice(beginIndex, endIndex);
      // always want to check, never toggle
      sliced.forEach(item => {
        if (!this.checked.includes(item._id)) {
          this.checked.push(item._id);
        }
      });
      this.lastSelected = sliced[sliced.length - 1]._id;
      this.editing = undefined;
    },
    // Toolbar handlers
    selectClick() {
      this.selectAll();
      this.editing = undefined;
    },
    async updatePage(num) {
      if (num) {
        this.currentPage = num;
        await this.getMedia();
      }
    },
    // TODO stub
    trashClick() {
      this.$emit('trash', this.checked);
    },
    search(query) {
      // TODO stub
      this.$emit('search', query);
    },
    async onContentChanged() {
      await this.getMedia({ tags: true });
    }
  }
};
</script>

<style lang="scss" scoped>
.apos-media-manager /deep/ .apos-media-manager-toolbar {
  z-index: $z-index-manager-toolbar;
  position: relative;
}
.apos-media-manager__empty {
  display: flex;
  justify-content: center;
  align-items: center;
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