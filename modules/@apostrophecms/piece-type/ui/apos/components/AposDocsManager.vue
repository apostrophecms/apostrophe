<template>
  <AposModal
    ref="modal"
    :modal="modal"
    :modal-title="modalTitle"
    :modal-data="modalData"
    @esc="confirmAndCancel"
    @inactive="modal.active = false"
    @show-modal="modal.showModal = true"
  >
    <template #secondaryControls>
      <AposButton
        v-if="relationshipField"
        type="default"
        label="apostrophe:cancel"
        @click="confirmAndCancel"
      />
      <AposButton
        v-else
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
        :attrs="{'data-apos-focus-priority': 1}"
        @click="saveRelationship"
      />
      <AposButton
        v-else-if="moduleOptions.canCreate && moduleOptions.showCreate"
        :label="{
          key: 'apostrophe:newDocType',
          type: $t(moduleOptions.label)
        }"
        type="primary"
        :attrs="{'data-apos-focus-priority': 1}"
        @click="create"
      />
    </template>
    <template
      v-if="relationshipField"
      #leftRail
    >
      <AposModalRail>
        <div class="apos-pieces-manager__relationship__rail">
          <div class="apos-pieces-manager__relationship__counts">
            <AposMinMaxCount
              :field="relationshipField"
              :model-value="checkedDocs"
            />
          </div>
          <AposSlatList
            class="apos-pieces-manager__relationship__items"
            :model-value="checkedDocs"
            :relationship-schema="relationshipField?.schema"
            @update:model-value="setCheckedDocs"
            @item-clicked="editRelationship"
          />
        </div>
      </AposModalRail>
    </template>
    <template #main>
      <AposModalBody>
        <template #bodyHeader>
          <AposDocsManagerToolbar
            :selected-state="selectAllState"
            :total-pages="totalPages"
            :current-page="currentPage"
            :filter-choices="filterChoices"
            :filter-values="filterValues"
            :filters="moduleOptions.filters"
            :labels="moduleLabels"
            :displayed-items="items.length"
            :is-relationship="!!relationshipField"
            :checked="checked"
            :checked-count="checked.length"
            :batch-operations="moduleOptions.batchOperations"
            :module-name="moduleName"
            :options="{
              disableUnchecked: maxReached()
            }"
            @select-click="selectAll"
            @search="onSearchDebounced"
            @page-change="updatePage"
            @filter="filter"
            @batch="handleBatchAction"
          />
          <AposDocsManagerSelectBox
            :selected-state="selectAllState"
            :module-labels="moduleLabels"
            :filter-values="filterValues"
            :checked-ids="checked"
            :all-pieces-selection="allPiecesSelection"
            :displayed-items="items.length"
            @select-all="selectAllPieces"
            @set-all-pieces-selection="setAllPiecesSelection"
          />
        </template>
        <template #bodyMain>
          <AposDocsManagerDisplay
            v-if="items.length > 0"
            v-model:checked="checked"
            :items="items"
            :headers="headers"
            :options="{
              ...moduleOptions,
              disableUnchecked: maxReached(),
              disableUnpublished: disableUnpublished,
              manuallyPublished: manuallyPublished
            }"
            @open="edit"
          />
          <div
            v-else
            class="apos-pieces-manager__empty"
          >
            <AposEmptyState :empty-state="emptyDisplay" />
          </div>
        </template>
      </AposModalBody>
    </template>
  </AposModal>
</template>

<script>
import { mapState } from 'pinia';
import AposDocsManagerMixin from 'Modules/@apostrophecms/modal/mixins/AposDocsManagerMixin';
import AposModifiedMixin from 'Modules/@apostrophecms/ui/mixins/AposModifiedMixin';
import AposPublishMixin from 'Modules/@apostrophecms/ui/mixins/AposPublishMixin';
import { useModalStore } from 'Modules/@apostrophecms/ui/stores/modal';
import { debounceAsync } from 'Modules/@apostrophecms/ui/utils';

export default {
  name: 'AposDocsManager',
  mixins: [
    AposDocsManagerMixin, AposModifiedMixin, AposPublishMixin
  ],
  props: {
    moduleName: {
      type: String,
      required: true
    },
    modalData: {
      type: Object,
      required: true
    }
  },
  emits: [ 'archive' ],
  data() {
    return {
      modal: {
        active: false,
        triggerFocusRefresh: 0,
        type: 'overlay',
        showModal: false
      },
      headers: [],
      items: [],
      lastSelected: null,
      totalPages: 1,
      currentPage: 1,
      filterValues: {},
      queryExtras: {
        viewContext: this.relationshipField ? 'relationship' : 'manage'
      },
      holdQueries: false,
      filterChoices: {},
      allPiecesSelection: {
        isSelected: false,
        total: 0
      }
    };
  },
  computed: {
    ...mapState(useModalStore, [ 'activeModal' ]),
    moduleOptions() {
      return window.apos.modules[this.moduleName];
    },
    moduleLabels() {
      return {
        singular: this.moduleOptions.label,
        plural: this.moduleOptions.pluralLabel
      };
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
    modalTitle () {
      const verb = this.relationshipField ? 'choose' : 'manage';
      return {
        key: (verb === 'choose') ? 'apostrophe:chooseDocType' : 'apostrophe:manageDocType',
        type: this.$t(this.moduleLabels.plural)
      };
    },
    emptyDisplay() {
      return {
        title: {
          key: 'apostrophe:noTypeFound',
          type: this.$t(this.moduleLabels.plural || this.moduleLabels.singular)
        },
        message: '',
        emoji: '📄'
      };
    },
    disableUnpublished() {
      return this.relationshipField &&
        apos.modules[this.relationshipField.withType].localized;
    },
    selectAllChoice() {
      const checkCount = this.checked.length;
      const pageNotFullyChecked = this.items
        .some((item) => !this.checked.includes(item._id));

      return {
        value: 'checked',
        indeterminate: checkCount && pageNotFullyChecked
      };
    }
  },
  created() {
    const DEBOUNCE_TIMEOUT = 500;
    this.onSearchDebounced = debounceAsync(this.onSearch, DEBOUNCE_TIMEOUT, {
      onSuccess: this.search
    });

    this.moduleOptions.filters.forEach(filter => {
      this.filterValues[filter.name] = filter.def;
      if (!filter.choices) {
        this.queryExtras.choices = this.queryExtras.choices || [];
        this.queryExtras.choices.push(filter.name);
      }
    });
  },
  async mounted() {
    this.bindShortcuts();
    this.headers = this.computeHeaders();
    // Get the data. This will be more complex in actuality.
    this.modal.active = true;
    await this.managePieces();
    await this.manageAllPiecesTotal();
    this.modal.triggerFocusRefresh++;

    apos.bus.$on('content-changed', this.onContentChanged);
    apos.bus.$on('command-menu-manager-create-new', this.create);
    apos.bus.$on('command-menu-manager-close', this.confirmAndCancel);
  },
  onBeforeUnmount() {
    this.onSearchDebounced.cancel();
  },
  unmounted() {
    this.destroyShortcuts();
    apos.bus.$off('content-changed', this.onContentChanged);
    apos.bus.$off('command-menu-manager-create-new', this.create);
    apos.bus.$off('command-menu-manager-close', this.confirmAndCancel);
  },
  methods: {
    async create() {
      await this.edit(null);
    },
    // If pieceOrId is null, a new piece is created
    async edit(pieceOrId) {
      let piece = null;
      if ((typeof pieceOrId) === 'object') {
        piece = pieceOrId;
      } else if (pieceOrId) {
        piece = this.items.find(item => item._id === pieceOrId);
      }

      const moduleName = this.getDocModuleName(piece);
      await apos.modal.execute(apos.modules[moduleName].components.editorModal, {
        moduleName,
        docId: piece && piece._id,
        filterValues: this.filterValues
      });
    },
    async finishSaved() {
      await this.managePieces();
    },
    async request(mergeOptions) {
      const options = {
        ...this.filterValues,
        ...this.queryExtras,
        ...mergeOptions,
        withPublished: 1
      };

      const type = this.relationshipField?.withType;
      const isPage = apos.modules['@apostrophecms/page'].validPageTypes
        .includes(type);

      if (isPage) {
        options.type = type;
      }

      // Avoid undefined properties.
      const qs = Object.entries(options)
        .reduce((acc, [ key, val ]) => ({
          ...acc,
          ...val !== undefined && { [key]: val }
        }), {});

      return apos.http.get(this.moduleOptions.action, {
        qs,
        busy: true,
        draft: true
      });
    },
    async requestPieces(page = 1, mergeOptions = {}) {
      const {
        currentPage, pages, results, choices
      } = await this.request({
        ...mergeOptions,
        ...(
          this.moduleOptions.managerApiProjection &&
          { project: this.moduleOptions.managerApiProjection }
        ),
        page
      });

      return {
        currentPage,
        pages,
        results,
        choices
      };
    },
    async requestAllPiecesTotal() {
      const { count: total } = await this.request({ count: 1 });
      return total;
    },
    async requestData(page = 1, mergeOptions = {}) {
      const pieces = await this.requestPieces(page, mergeOptions);
      const total = await this.requestAllPiecesTotal();

      return {
        ...pieces,
        total
      };
    },
    setPieces(data) {
      this.currentPage = data.currentPage;
      this.totalPages = data.pages;
      this.items = data.results;
      this.filterChoices = data.choices;
    },
    async managePieces () {
      if (this.holdQueries) {
        return;
      }

      this.holdQueries = true;

      const {
        currentPage, pages, results, choices
      } = await this.requestPieces(this.currentPage);

      this.setPieces({
        currentPage,
        pages,
        results,
        choices
      });
      this.holdQueries = false;
    },
    async manageAllPiecesTotal () {
      const total = await this.requestAllPiecesTotal();

      this.setAllPiecesSelection({
        isSelected: false,
        total
      });
    },
    async selectAllPieces () {
      const { results: docs } = await this.request({
        project: {
          _id: 1,
          _url: 1,
          title: 1
        },
        attachments: false,
        perPage: this.allPiecesSelection.total
      });

      this.setAllPiecesSelection({
        isSelected: true,
        docs
      });
    },
    async updatePage(num) {
      if (num) {
        this.currentPage = num;
        await this.managePieces();
      }
    },
    // A stateless search handler, only requesting the data.
    // It's meant to be debounced and used in conjunction with the search
    // method that actually updates the state.
    async onSearch(query) {
      const queryExtras = { ...this.queryExtras };
      if (query) {
        queryExtras.autocomplete = query;
      } else if ('autocomplete' in this.queryExtras) {
        queryExtras.autocomplete = undefined;
      }
      const { total, ...pieces } = await this.requestData(1, queryExtras);

      return {
        pieces,
        total
      };
    },
    async search({ pieces, total }) {
      // Most probably due to empty/invalid query.
      if (!pieces) {
        return;
      }

      this.currentPage = 1;

      this.setPieces(pieces);
      this.setAllPiecesSelection({
        isSelected: false,
        total
      });
    },
    async filter(filter, value) {
      if (this.filterValues[filter] === value) {
        return;
      }

      this.filterValues[filter] = value;
      this.currentPage = 1;

      await this.managePieces();
      await this.manageAllPiecesTotal();
      this.headers = this.computeHeaders();

      this.setCheckedDocs([]);
    },
    shortcutNew(event) {
      const interesting = event.keyCode === 78; // N(ew)
      if (
        interesting &&
        document.activeElement.tagName !== 'INPUT' &&
        this.$refs.modal.id === this.activeModal?.id
      ) {
        this.create();
      }
    },
    bindShortcuts() {
      window.addEventListener('keydown', this.shortcutNew);
    },
    destroyShortcuts() {
      window.removeEventListener('keydown', this.shortcutNew);
    },
    computeHeaders() {
      let headers = this.moduleOptions.columns || [];
      if (this.filterValues.archived) {
        headers = headers.filter(h => h.component !== 'AposCellLabels');
      }
      return headers;
    },
    async editRelationship(item) {
      const result = await apos.modal.execute('AposRelationshipEditor', {
        schema: this.relationshipField.schema,
        title: item.title,
        modelValue: item._fields
      });
      if (result) {
        this.checkedDocs = this.checkedDocs.map((doc) => {
          if (doc._id !== item._id) {
            return doc;
          }
          return {
            ...doc,
            _fields: result
          };
        });
      }
    },
    setAllPiecesSelection ({
      isSelected, total, docs
    }) {
      if (typeof isSelected === 'boolean') {
        this.allPiecesSelection.isSelected = isSelected;
      }

      if (typeof total === 'number') {
        this.allPiecesSelection.total = total;
      }

      if (docs) {
        this.setCheckedDocs(docs);
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
            interpolate: { operation: label },
            type: 'danger'
          });
          // eslint-disable-next-line no-console
          console.error(error);
        }
      }
    },
    setCheckedDocs(checked) {
      this.checkedDocs = checked.slice(0, this.relationshipField?.max || checked.length);
      this.checked = this.checkedDocs.map(item => {
        return item._id;
      });
    },
    async onContentChanged({
      doc, action, docIds, docTypes
    }) {
      const types = this.getContentChangedTypes(doc, docTypes);
      if (!types.includes(this.moduleName)) {
        return;
      }
      if (
        docIds ||
        !doc.aposLocale ||
        doc.aposLocale.split(':')[0] === this.modalData.locale
      ) {
        await this.managePieces();
        await this.manageAllPiecesTotal();
        if ([ 'archive', 'restore' ].includes(action)) {
          const ids = docIds || [ doc._id ];
          this.checked = this.checked.filter(checkedId => !ids.includes(checkedId));
        }
      }
    }
  }
};
</script>

<style lang="scss" scoped>
  // TODO: .apos-pieces-manager__empty is shared with
  // `apos-media-manager__empty`. We should combine somehow.
  .apos-pieces-manager__empty {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    margin-top: 130px;
  }

  .apos-pieces-manager__relationship__rail {
    padding: 20px;
  }

  .apos-pieces-manager__relationship__counts {
    margin-bottom: 20px;
  }
</style>
