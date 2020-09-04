<template>
  <AposModal
    :modal="modal" :modal-title="moduleTitle"
    @esc="cancel" @no-modal="$emit('safe-close')"
    @inactive="modal.active = false" @show-modal="modal.showModal = true"
  >
    <template #primaryControls>
      <AposButton
        type="default" label="Finished"
        @click="cancel"
      />
      <AposButton
        :label="`New ${ options.label }`" type="primary"
        @click="editing = true"
      />
    </template>

    <template #leftRail>
      <AposModalRail>
        <AposSlatList @update="updated" :initial-items="selectedItems" />
      </AposModalRail>
    </template>

    <template #main>
      <AposModalBody>
        <template #bodyHeader>
          <AposPiecesManagerToolbar
            :selected-state="selectAllState"
            :total-pages="totalPages" :current-page="currentPage"
            :filters="options.filters" :labels="moduleLabels"
            @select-click="selectAll"
            @trash-click="trashClick"
            @search="search"
            @page-change="updatePage"
            @filter="filter"
          />
        </template>
        <template #bodyMain>
          <table class="apos-table" v-if="rows.length > 0">
            <tbody>
              <tr>
                <th class="apos-table__header" />
                <th
                  v-for="header in headers" scope="col"
                  class="apos-table__header" :key="header.label"
                >
                  <component
                    :is="getEl(header)" @click="sort(header.action)"
                    class="apos-table__header-label"
                  >
                    <component
                      v-if="header.labelIcon"
                      :is="icons[header.labelIcon]"
                      :size="iconSize(header)"
                      class="apos-table__header-icon"
                    />
                    {{ header.label }}
                  </component>
                </th>
              </tr>
              <tr
                class="apos-table__row"
                v-for="row in rows"
                :key="row._id"
                :class="{'is-selected': false }"
              >
                <td class="apos-table__cell">
                  <AposCheckbox
                    v-if="checkboxes[row._id]"
                    :field="checkboxes[row._id].field"
                    :value="checkboxes[row._id].value.data"
                    :status="checkboxes[row._id].status"
                    :choice="checkboxes[row._id].choice"
                    :id="row._id"
                    v-model="checked"
                    @updated="updateItems"
                  />
                </td>
                <td
                  class="apos-table__cell" v-for="header in headers"
                  :key="row[header.name]"
                >
                  <a
                    v-if="header.name === 'url'" class="apos-table__link"
                    :href="row[header.name]"
                  >
                    <LinkIcon :size="12" />
                  </a>
                  <button
                    v-else-if="header.name === 'title'"
                    @click="openEditor(row._id)"
                    class="apos-table__cell-field"
                    :class="`apos-table__cell-field--${header.name}`"
                  >
                    {{ row[header.name] }}
                  </button>
                  <p
                    v-else class="apos-table__cell-field"
                    :class="`apos-table__cell-field--${header.name}`"
                  >
                    {{ row[header.name] }}
                  </p>
                </td>
              </tr>
            </tbody>
          </table>
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
import AposTableMixin from 'Modules/@apostrophecms/modal/mixins/AposTableMixin';
import AposModalParentMixin from 'Modules/@apostrophecms/modal/mixins/AposModalParentMixin';

export default {
  name: 'AposJoinsManager',
  mixins: [ AposTableMixin, AposModalParentMixin ],
  props: {
    moduleName: {
      type: String,
      required: true
    },
    items: {
      type: Array
    }
  },
  emits: [ 'trash', 'search', 'safe-close' ],
  data() {
    return {
      modal: {
        active: false,
        type: 'overlay',
        showModal: false
      },
      pieces: [],
      selectedItems: this.items,
      lastSelected: null,
      totalPages: 1,
      currentPage: 1,
      filterValues: {},
      editing: false,
      editingDocId: '',
      queryExtras: {},
      holdQueries: false,
      checked: this.items.map(item => item._id)
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
      return `Manage ${this.moduleLabels.plural}`;
    },
    rows() {
      const rows = [];
      if (!this.pieces || !this.headers.length) {
        return [];
      }

      this.pieces.forEach(piece => {
        const data = {};

        this.headers.forEach(column => {
          data[column.name] = piece[column.name];
          data._id = piece._id;
        });
        rows.push(data);
      });

      return rows;
    },
    emptyDisplay() {
      return {
        title: `No ${this.moduleLabels.plural || this.moduleLabels.singular} Found`,
        message: '',
        emoji: '📄'
      };
    },
    selectAllState() {
      if (this.selectAllValue.data.length && !this.selectAllChoice.indeterminate) {
        return 'checked';
      }
      if (this.selectAllValue.data.length && this.selectAllChoice.indeterminate) {
        return 'indeterminate';
      }
      return 'empty';
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
    // Toolbar handlers
    trashClick() {
      // TODO: Trigger a confirmation modal and execute the deletion.
      this.$emit('trash', this.selected);
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
    updated(items) {
      this.selectedItems = items;
      this.checked = items.map(item => item._id);
      this.$emit('updated', items);
    },
    updateItems(event) {
      //TODO: limit check possibilities if "max"
      const piece = this.pieces.find(piece => piece._id = event.target.id);
      if (piece) {
        this.selectedItems.push(piece);
      }
    }
  }
};
</script>

<style lang="scss" scoped>
  @import 'Modules/@apostrophecms/ui/scss/shared/_tables';
  // TODO: .apos-pieces-manager__empty is shared with
  // `apos-media-manager__empty`. We should combine somehow.
  .apos-pieces-manager__empty {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
    height: 100%;
    margin-top: 130px;
  }
</style>
