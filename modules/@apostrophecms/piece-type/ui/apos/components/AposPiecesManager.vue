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
        type="default" label="Cancel"
        @click="confirmAndCancel"
      />
      <AposButton
        v-else
        type="default" label="Finished"
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
        v-else
        :label="`New ${ options.label }`" type="primary"
        @click="edit(null)"
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
            :value="checkedDocs"
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
            :filters="options.filters"
            :filter-choices="filterChoices"
            :filter-values="filterValues"
            :labels="moduleLabels"
            @select-click="selectAll"
            @archive-click="archiveClick"
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
          <AposPiecesManagerDisplay
            v-if="pieces.length > 0"
            :items="pieces"
            :headers="headers"
            v-model="checked"
            @open="edit"
            @preview="preview"
            @copy="copy"
            @discardDraft="onDiscardDraft"
            @archive="onArchive"
            :options="{
              disableUnchecked: maxReached(),
              hideCheckboxes: !relationshipField,
              disableUnpublished: !!relationshipField
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
import AposPublishMixin from 'Modules/@apostrophecms/ui/mixins/AposPublishMixin';
import AposArchiveMixin from 'Modules/@apostrophecms/ui/mixins/AposArchiveMixin';
import AposModalModifiedMixin from 'Modules/@apostrophecms/modal/mixins/AposModalModifiedMixin';

export default {
  name: 'AposPiecesManager',
  mixins: [
    AposDocsManagerMixin,
    AposModalModifiedMixin,
    AposPublishMixin,
    AposArchiveMixin
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
      pieces: [],
      lastSelected: null,
      totalPages: 1,
      currentPage: 1,
      filterValues: {},
      queryExtras: {},
      holdQueries: false,
      moreMenu: {
        button: {
          label: 'More operations',
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
    options() {
      return window.apos.modules[this.moduleName];
    },
    moduleLabels() {
      return {
        singular: this.options.label,
        plural: this.options.pluralLabel
      };
    },
    saveRelationshipLabel() {
      if (this.relationshipField && (this.relationshipField.max === 1)) {
        return `Select ${this.moduleLabels.label || ''}`;
      } else {
        return `Select ${this.moduleLabels.pluralLabel || ''}`;
      }
    },
    modalTitle () {
      const verb = this.relationshipField ? 'Choose' : 'Manage';
      return `${verb} ${this.moduleLabels.plural}`;
    },
    emptyDisplay() {
      return {
        title: `No ${this.moduleLabels.plural || this.moduleLabels.singular} Found`,
        message: '',
        emoji: '📄'
      };
    }
  },
  created() {
    this.options.filters.forEach(filter => {
      this.filterValues[filter.name] = filter.def;
      if (!filter.choices) {
        this.queryExtras.choices = this.queryExtras.choices || [];
        this.queryExtras.choices.push(filter.name);
      }
    });
  },
  async mounted() {
    this.bindShortcuts();
    // Get the data. This will be more complex in actuality.
    this.modal.active = true;
    this.getPieces();
    if (this.relationshipField) {
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
        this.new();
      }
    },
    setCheckedDocs(checked) {
      this.checkedDocs = checked;
      this.checked = this.checkedDocs.map(item => {
        return item._id;
      });
    },
    new() {
      this.edit(null);
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
          qs,
          draft: true
        }
      ));

      this.currentPage = getResponse.currentPage;
      this.totalPages = getResponse.pages;
      this.pieces = getResponse.results;
      this.filterChoices = getResponse.choices;
      this.holdQueries = false;
    },
    updatePage(num) {
      if (num) {
        this.currentPage = num;
        this.getPieces();
      }
    },
    preview(pieceId) {
      const piece = this.pieces.filter(p => p._id === pieceId)[0];
      if (piece._url) {
        window.open(piece._url, '_blank').focus();
      }
    },
    async onArchive(pieceId) {
      const piece = this.pieces.filter(p => p._id === pieceId)[0];
      if (await this.archive(this.options.action, pieceId, !!piece.lastPublishedAt)) {
        apos.bus.$emit('content-changed');
      }
    },
    async onDiscardDraft(pieceId) {
      const piece = this.pieces.filter(p => p._id === pieceId)[0];
      if (await this.discardDraft(this.options.action, pieceId, !!piece.lastPublishedAt)) {
        apos.bus.$emit('content-changed');
      };
    },
    async copy(pieceId) {
      const piece = this.pieces.filter(p => p._id === pieceId)[0];
      apos.bus.$emit('admin-menu-click', {
        itemName: `${this.options.name}:editor`,
        props: {
          copyOf: piece
        }
      });
    },
    async edit(pieceId) {
      const doc = await apos.modal.execute(this.options.components.insertModal, {
        moduleName: this.moduleName,
        docId: pieceId,
        filterValues: this.filterValues
      });
      if (!doc) {
        // Cancel clicked
        return;
      }
      await this.getPieces();
      if (this.relationshipField && (!pieceId)) {
        doc._fields = doc._fields || {};
        // Must push to checked docs or it will try to do it for us
        // and not include _fields
        this.checkedDocs.push(doc);
        this.checked.push(doc._id);
      }
    },
    // Toolbar handlers
    archiveClick() {
      // TODO: Trigger a confirmation modal and execute the deletion.
      this.$emit('archive', this.checked);
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

    shortcutNew(event) {
      const interesting = (event.keyCode === 78 || event.keyCode === 67); // C(reate) or N(ew)
      const topModal = apos.modal.stack[apos.modal.stack.length - 1] ? apos.modal.stack[apos.modal.stack.length - 1].id : null;
      if (
        interesting &&
        document.activeElement.tagName !== 'INPUT' &&
        this.$refs.modal.id === topModal
      ) {
        this.new();
      }
    },

    bindShortcuts() {
      window.addEventListener('keydown', this.shortcutNew);
    },
    destroyShortcuts() {
      window.removeEventListener('keydown', this.shortcutNew);
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
