<template>
  <AposModal
    :modal="modal" :modal-title="modalTitle"
    ref="modal"
    @esc="confirmAndCancel" @no-modal="$emit('safe-close')"
    @inactive="modal.active = false" @show-modal="modal.showModal = true"
  >
    <template #secondaryControls>
      <AposButton
        v-if="relationshipField"
        type="default" label="apostrophe:cancel"
        @click="confirmAndCancel"
      />
      <AposButton
        v-else
        type="default" label="apostrophe:exit"
        @click="confirmAndCancel"
      />
    </template>
    <template #primaryControls>
      <AposContextMenu
        v-if="moreMenu.menu.length"
        :button="moreMenu.button"
        :menu="moreMenu.menu"
        @item-clicked="moreMenuHandler"
      />
      <AposButton
        v-if="relationshipField"
        type="primary"
        :label="saveRelationshipLabel"
        :disabled="!!relationshipErrors"
        @click="saveRelationship"
      />
      <AposButton
        v-else-if="moduleOptions.canEdit && moduleOptions.showCreate"
        :label="{
          key: 'apostrophe:newDocType',
          type: $t(moduleOptions.label)
        }" type="primary"
        @click="create"
      />
    </template>
    <template v-if="relationshipField" #leftRail>
      <AposModalRail>
        <div class="apos-pieces-manager__relationship__rail">
          <div class="apos-pieces-manager__relationship__counts">
            <AposMinMaxCount
              :field="relationshipField"
              :value="checkedDocs"
            />
          </div>
          <AposSlatList
            class="apos-pieces-manager__relationship__items"
            @input="setCheckedDocs"
            @item-clicked="editRelationship"
            :value="checkedDocs"
            :has-relationship-schema="!!(relationshipField && relationshipField.schema)"
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
            :filters="moduleOptions.filters"
            :filter-choices="filterChoices"
            :filter-values="filterValues"
            :labels="moduleLabels"
            @select-click="selectAll"
            @search="search"
            @page-change="updatePage"
            @filter="filter"
            :options="{
              disableUnchecked: maxReached(),
              hideSelectAll: !relationshipField
            }"
          />
        </template>
        <template #bodyMain>
          <AposDocsManagerDisplay
            v-if="items.length > 0"
            :items="items"
            :headers="headers"
            v-model="checked"
            @open="edit"
            :options="{
              ...moduleOptions,
              disableUnchecked: maxReached(),
              hideCheckboxes: !relationshipField,
              disableUnpublished: disableUnpublished,
              manuallyPublished: manuallyPublished
            }"
          />
          <div v-else class="apos-pieces-manager__empty">
            <AposEmptyState :empty-state="emptyDisplay" />
          </div>
        </template>
      </AposModalBody>
    </template>
  </AposModal>
</template>

<script>
import AposDocsManagerMixin from 'Modules/@apostrophecms/modal/mixins/AposDocsManagerMixin';
import AposModifiedMixin from 'Modules/@apostrophecms/ui/mixins/AposModifiedMixin';
import AposPublishMixin from 'Modules/@apostrophecms/ui/mixins/AposPublishMixin';

export default {
  name: 'AposDocsManager',
  mixins: [
    AposDocsManagerMixin, AposModifiedMixin, AposPublishMixin
  ],
  props: {
    moduleName: {
      type: String,
      required: true
    }
  },
  emits: [ 'archive', 'safe-close' ],
  data() {
    return {
      modal: {
        active: false,
        type: 'overlay',
        showModal: false
      },
      headers: [],
      items: [],
      lastSelected: null,
      totalPages: 1,
      currentPage: 1,
      filterValues: {},
      queryExtras: {},
      holdQueries: false,
      moreMenu: {
        button: {
          label: 'apostrophe:moreOperations',
          iconOnly: true,
          icon: 'dots-vertical-icon',
          type: 'outline'
        },
        menu: []
      },
      filterChoices: {}
    };
  },
  computed: {
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
          typeLabel: this.$t(this.moduleLabels.label)
        };
      } else {
        return {
          key: 'apostrophe:selectManyLabel',
          typeLabel: this.$t(this.moduleLabels.pluralLabel)
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
      return this.relationshipField && apos.modules[this.relationshipField.withType].localized;
    }
  },
  created() {
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
    this.getPieces();
    if (this.relationshipField && this.moduleOptions.canEdit) {
      // Add computed singular label to context menu
      this.moreMenu.menu.unshift({
        action: 'new',
        label: `New ${this.moduleLabels.singular}`
      });
    }
    apos.bus.$on('content-changed', this.getPieces);
  },
  destroyed() {
    this.destroyShortcuts();
    apos.bus.$off('content-changed', this.getPieces);
  },
  methods: {
    moreMenuHandler(action) {
      if (action === 'new') {
        this.create();
      }
    },
    setCheckedDocs(checked) {
      this.checkedDocs = checked;
      this.checked = this.checkedDocs.map(item => {
        return item._id;
      });
    },
    async create() {
      await this.edit(null);
    },
    // If pieceOrId is null, a new piece is created
    async edit(pieceOrId) {
      let piece;
      if ((typeof pieceOrId) === 'object') {
        piece = pieceOrId;
      } else if (pieceOrId) {
        piece = this.items.find(item => item._id === pieceOrId);
      } else {
        piece = null;
      }
      let moduleName;
      // Don't assume the piece has the type of the module,
      // this could be a virtual piece type such as "submitted-draft"
      // that manages docs of many types
      if (piece) {
        if (piece.slug.startsWith('/')) {
          moduleName = '@apostrophecms/page';
        } else {
          moduleName = piece.type;
        }
      } else {
        moduleName = this.moduleName;
      }

      await apos.modal.execute(apos.modules[moduleName].components.editorModal, {
        moduleName,
        docId: piece && piece._id,
        filterValues: this.filterValues
      });
    },
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
        ...this.queryExtras,
        // Also fetch published docs as _publishedDoc subproperties
        withPublished: 1
      };

      // Avoid undefined properties.
      for (const prop in qs) {
        if (qs[prop] === undefined) {
          delete qs[prop];
        };
      }

      const getResponse = await apos.http.get(
        this.moduleOptions.action, {
          busy: true,
          qs,
          draft: true
        }
      );

      this.currentPage = getResponse.currentPage;
      this.totalPages = getResponse.pages;
      this.items = getResponse.results;
      this.filterChoices = getResponse.choices;
      this.holdQueries = false;
    },
    updatePage(num) {
      if (num) {
        this.currentPage = num;
        this.getPieces();
      }
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
      this.headers = this.computeHeaders();
    },

    shortcutNew(event) {
      const interesting = (event.keyCode === 78 || event.keyCode === 67); // C(reate) or N(ew)
      const topModal = apos.modal.stack[apos.modal.stack.length - 1] ? apos.modal.stack[apos.modal.stack.length - 1].id : null;
      if (
        interesting &&
        document.activeElement.tagName !== 'INPUT' &&
        this.$refs.modal.id === topModal
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
        value: item._fields
      });
      if (result) {
        const index = this.checkedDocs.findIndex(_item => _item._id === item._id);
        this.$set(this.checkedDocs, index, {
          ...this.checkedDocs[index],
          _fields: result
        });
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
    justify-content: center;
    align-items: center;
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
