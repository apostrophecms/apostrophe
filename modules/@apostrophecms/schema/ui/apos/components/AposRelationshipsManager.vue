<template>
  <AposModal
    :modal="modal" :modal-title="moduleTitle"
    @esc="cancel" @no-modal="$emit('safe-close')"
    @inactive="modal.active = false" @show-modal="modal.showModal = true"
  >
    <template #primaryControls>
      <AposButton
        :label="`New ${ options.label }`" type="default"
        @click="editing = true"
      />
      <AposButton
        type="primary" label="Exit"
        @click="cancel"
      />
    </template>
    <template #leftRail>
      <AposModalRail>
        <AposSlatList
          @update="updateSlatList"
          :initial-items="selectedItems" :field="field"
        />
      </AposModalRail>
    </template>

    <template #main>
      <AposModalBody>
        <template #bodyHeader>
          <AposDocsManagerToolbar
            :selected-state="selectAllState"
            :total-pages="totalPages" :current-page="currentPage"
            :filters="options.filters" :labels="moduleLabels"
            @select-click="selectAll"
            @search="search"
            @page-change="updatePage"
            @filter="filter"
          />
        </template>
        <template #bodyMain>
          <AposPiecesManagerView
            v-if="items.length > 0"
            :items="items"
            :headers="headers"
            v-model="checked"
            :field="field"
            @open="openEditor"
            @updated="updateSelectedItems"
          />
          <div v-else class="apos-pieces-manager__empty">
            <AposEmptyState :empty-state="emptyDisplay" />
          </div>
        </template>
      </AposModalBody>
      <!-- The pieces editor modal. -->
      <component
        v-if="editing"
        :is="options.components.insertModal"
        :module-name="moduleName" :doc-id="editingDocId"
        :filter-values="filterValues"
        @saved="finishSaved" @safe-close="closeEditor"
      />
    </template>
  </AposModal>
</template>

<script>
import AposDocsManagerMixin from 'Modules/@apostrophecms/modal/mixins/AposDocsManagerMixin';
import AposModalParentMixin from 'Modules/@apostrophecms/modal/mixins/AposModalParentMixin';

export default {
  name: 'AposRelationshipsManager',
  mixins: [ AposDocsManagerMixin, AposModalParentMixin ],
  props: {
    // TEMP From Manager Mixin:
    // headers
    // selectAllValue
    // selectAllChoice
    moduleName: {
      type: String,
      required: true
    },
    initiallySelectedItems: {
      type: Array,
      default: function () {
        return [];
      }
    },
    field: {
      type: Object,
      default() {
        return {};
      }
    }
  },
  emits: [ 'trash', 'search', 'safe-close', 'updated' ],
  data() {
    return {
      // TEMP From Manager Mixin:
      // icons: {},
      // checked: [] <== OVERIDDEN BELOW
      modal: {
        active: false,
        type: 'overlay',
        showModal: false
      },
      pieces: [],
      lastSelected: null,
      totalPages: 1,
      currentPage: 1,
      filterValues: {},
      editing: false,
      editingDocId: '',
      queryExtras: {},
      holdQueries: false,
      selectedItems: this.initiallySelectedItems,
      checked: this.initiallySelectedItems.map(item => item._id) // NOTE: originally set in AposDocsManagerMixin.js
    };
  },
  computed: {
    options() {
      return window.apos.modules[this.moduleName];
    },
    moduleLabels() {
      return {
        singular: this.options.label,
        plural: this.options.pluralLabel
      };
    },
    moduleTitle () {
      return `Select ${this.moduleLabels.plural}`;
    },
    items() {
      const items = [];
      if (!this.pieces || !this.headers.length) {
        return [];
      }

      this.pieces.forEach(piece => {
        const data = {};

        this.headers.forEach(column => {
          data[column.name] = piece[column.name];
          data._id = piece._id;
        });
        items.push(data);
      });

      return items;
    },
    emptyDisplay() {
      return {
        title: `No ${this.moduleLabels.plural || this.moduleLabels.singular} Found`,
        message: '',
        emoji: '📄'
      };
    }
  },
  watch: {
    // TEMP From Manager Mixin:
    // items: function(newValue) {
    //   if (newValue.length) {
    //     this.generateUi();
    //   }
    // }
    // NOTE: revisit this during refactoring
    checked: function() {
      this.generateUi();
      if (!this.checked.length) {
        this.selectedItems = [];
        this.$emit('updated', this.selectedItems);
      }
    }
  },
  created() {
    this.options.filters.forEach(filter => {
      this.filterValues[filter.name] = filter.def || filter.choices[0].value;
    });
  },
  async mounted() {
    // Get the data. This will be more complex in actuality.
    this.modal.active = true;
    this.getPieces();
  },
  methods: {
    // TEMP From Manager Mixin:
    // toggleRowCheck
    // selectAll
    // iconSize
    // sort
    // generateUi
    // generateIcons
    // generateCheckboxes
    async finishSaved() {
      await this.getPieces();
    },
    async getPieces () {
      if (this.holdQueries) {
        return;
      }

      this.holdQueries = true;

      const qs = {
        ...this.filterValues,
        page: this.currentPage,
        ...this.queryExtras
      };

      // Avoid undefined properties.
      for (const prop in qs) {
        if (qs[prop] === undefined) {
          delete qs[prop];
        };
      }

      const getResponse = (await apos.http.get(
        this.options.action, {
          busy: true,
          qs
        }
      ));

      this.currentPage = getResponse.currentPage;
      this.totalPages = getResponse.pages;
      this.pieces = getResponse.results;
      this.holdQueries = false;
    },
    updatePage(num) {
      if (num) {
        this.currentPage = num;
        this.getPieces();
      }
    },
    openEditor(docId) {
      this.editingDocId = docId;
      this.editing = true;
    },
    closeEditor() {
      this.editing = false;
      this.editingDocId = '';
    },
    async search(query) {
      if (query) {
        this.queryExtras.autocomplete = query;
      } else if ('autocomplete' in this.queryExtras) {
        delete this.queryExtras.autocomplete;
      } else {
        return;
      }

      this.currentPage = 1;

      await this.getPieces();
    },
    async filter(filter, value) {
      if (this.filterValues[filter] === value) {
        return;
      }

      this.filterValues[filter] = value;
      this.currentPage = 1;

      this.getPieces();
    },
    updateSlatList(items) {
      this.selectedItems = items;
      this.checked = items.map(item => item._id);
      this.$emit('updated', items);
    },
    updateSelectedItems(itemId) {
      if (this.checked.length > this.selectedItems.length) {
        const piece = this.pieces.find(piece => {
          return piece._id === itemId;
        });

        if (this.field.max) {
          if (this.selectedItems.length < this.field.max) {
            this.selectedItems.push(piece);
          }
        } else {
          this.selectedItems.push(piece);
        }
      } else {
        this.selectedItems = this.selectedItems.filter(item => {
          return item._id !== itemId;
        });
      }
      this.checked = this.selectedItems.map(item => item._id);
      this.$emit('updated', this.selectedItems);
    }
  }
};
</script>

<style lang="scss" scoped>
  // TODO: .apos-pieces-manager__empty is shared with
  // `apos-media-manager__empty`. We should combine somehow.
  // Maybe move this style to AposEmptyState and make it conditional on being
  // inside the modal main area.
  .apos-pieces-manager__empty {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
    height: 100%;
    margin-top: 130px;
  }
</style>
