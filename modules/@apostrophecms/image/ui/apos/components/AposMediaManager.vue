<!--
  AposMediaManager will be in charge of all media-related state logic
  this includes doing the selecting and deselecting of items, deciding the editor/selection view,
  emitting batch action events, etc. All sub views will recieve `media` as a prop
-->

<template>
  <AposModal
    :modal="modal" :modal-title="moduleTitle"
    class="apos-media-manager"
    @inactive="modal.active = false" @show-modal="modal.showModal = true"
    @esc="cancel" @no-modal="$emit('safe-close')"
  >
    <template v-if="relationshipField" #primaryControls>
      <AposButton
        type="default" label="Cancel"
        @click="cancel"
      />
      <AposButton
        :label="`Save`" type="primary"
        :disabled="relationshipErrors === 'min'"
        @click="saveRelationship"
      />
    </template>
    <template v-else #primaryControls>
      <AposButton
        type="default" label="Finished"
        @click="cancel"
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
            :options="{ disableUnchecked: relationshipErrors === 'max' }"
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
import AposModalParentMixin from 'Modules/@apostrophecms/modal/mixins/AposModalParentMixin';
import AposDocsManagerMixin from 'Modules/@apostrophecms/modal/mixins/AposDocsManagerMixin';
import cuid from 'cuid';

export default {
  mixins: [ AposModalParentMixin, AposDocsManagerMixin ],
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
      editing: null,
      uploading: false,
      lastSelected: null,
      emptyDisplay: {
        title: 'No Media Found',
        message: 'Uploaded media will appear here',
        emoji: '🖼'
      }
    };
  },
  computed: {
    moduleTitle () {
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
    }
  },
  watch: {
    checked (newVal) {
      if (this.editing && newVal.includes(this.editing._id)) {
        return;
      }

      if (newVal.length > 1 || newVal.length === 0) {
        this.editing = null;
      }
    }
  },
  async mounted() {
    this.modal.active = true;
    await this.getMedia();
  },
  methods: {
    async getMedia () {
      const qs = {
        ...this.filterValues,
        page: this.currentPage
      };

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
          qs
        }
      ));

      this.tagList = apiResponse.choices ? apiResponse.choices._tags : [];
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
    async completeUploading (imgId) {
      this.uploading = false;
      await this.getMedia();

      if (imgId) {
        this.checked.push(imgId);

        // If we're currently editing one, don't interrupt that by replacing it.
        if (!this.editing) {
          this.updateEditing(imgId);
        }
      }
    },
    clearSelected() {
      this.checked = [];
      this.editing = null;
    },
    updateEditing(id) {
      this.editing = this.items.find(item => item._id === id);
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
      this.editing = null;
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
      this.editing = null;
    },

    // Toolbar handlers
    selectClick() {
      this.selectAll();
      this.editing = null;
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
