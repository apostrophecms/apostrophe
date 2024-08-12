// Pages manager (tree) modal business logic.

import AposModifiedMixin from 'Modules/@apostrophecms/ui/mixins/AposModifiedMixin';
import AposArchiveMixin from 'Modules/@apostrophecms/ui/mixins/AposArchiveMixin';
import AposPublishMixin from 'Modules/@apostrophecms/ui/mixins/AposPublishMixin';
import AposDocsManagerMixin from 'Modules/@apostrophecms/modal/mixins/AposDocsManagerMixin';
import { klona } from 'klona';
import { debounce } from 'Modules/@apostrophecms/ui/utils';

export default {
  name: 'AposPagesManager',
  mixins: [ AposModifiedMixin, AposDocsManagerMixin, AposArchiveMixin, AposPublishMixin ],
  emits: [ 'archive', 'search', 'modal-result' ],
  props: {
    modalData: {
      type: Object,
      required: true
    }
  },
  data() {
    return {
      moduleName: '@apostrophecms/page',
      modal: {
        active: false,
        triggerFocusRefresh: 0,
        type: 'slide',
        showModal: false,
        width: 'two-thirds'
      },
      headers: [],
      holdQueries: false,
      pages: [],
      pagesFlat: [],
      options: {
        columns: [
          {
            columnHeader: 'apostrophe:pageTitle',
            property: 'title',
            cellValue: 'title'
          },
          {
            name: 'labels',
            component: 'AposCellLabels'
          },
          {
            columnHeader: 'apostrophe:lastEdited',
            property: 'updatedAt',
            component: 'AposCellLastEdited',
            cellValue: 'updatedAt'
          },
          {
            property: 'contextMenu',
            component: 'AposCellContextMenu'
          }
        ]
      },
      moreMenu: [
        {
          label: 'apostrophe:newPage',
          action: 'new'
        }
      ],
      moreMenuButton: {
        tooltip: {
          content: 'apostrophe:moreOptions',
          placement: 'bottom'
        },
        label: 'apostrophe:moreOptions',
        icon: 'dots-vertical-icon',
        iconOnly: true,
        type: 'subtle',
        modifiers: [ 'small', 'no-motion' ]
      },
      queryExtras: {
        viewContext: this.relationshipField ? 'relationship' : 'manage'
      },
      filterValues: {},
      filterChoices: {},
      allPiecesSelection: {
        isSelected: false,
        total: 0
      }
    };
  },
  computed: {
    treeOptions() {
      return {
        bulkSelect: true,
        draggable: !this.filterValues.archived,
        ghostUnpublished: true,
        max: this.relationshipField.max || null
      };
    },
    moduleOptions() {
      return apos.page;
    },
    moduleLabels() {
      return {
        singular: this.moduleOptions.label,
        plural: this.moduleOptions.pluralLabel
      };
    },
    items() {
      if (!this.pages || !this.headers.length) {
        return [];
      }
      return klona(this.pages);
    },
    selectAllChoice() {
      const checkLen = this.checked.length;
      const rowLen = this.pagesFlat.length;

      return checkLen > 0 && checkLen !== rowLen ? {
        value: 'checked',
        indeterminate: true
      } : {
        value: 'checked'
      };
    },
    saveRelationshipLabel() {
      if (this.relationshipField && (this.relationshipField.max === 1)) {
        return 'apostrophe:selectPage';
      } else {
        return 'apostrophe:selectPages';
      }
    },
    canCreate() {
      const page = this.pagesFlat.find(page => page.aposDocId === this.moduleOptions.page.aposDocId);
      if (page) {
        return page._create;
      }
      return this.moduleOptions.canCreate;
    }
  },
  created() {
    const DEBOUNCE_TIMEOUT = 500;
    this.onSearch = debounce(this.search, DEBOUNCE_TIMEOUT);

    this.moduleOptions.filters.forEach(filter => {
      this.filterValues[filter.name] = filter.def;
      if (!filter.choices) {
        this.queryExtras.choices = this.queryExtras.choices || [];
        this.queryExtras.choices.push(filter.name);
      }
    });
  },
  async mounted() {
    this.headers = this.computeHeaders();
    // Get the data. This will be more complex in actuality.
    this.modal.active = true;
    await this.getPages();
    this.getAllPagesTotal();
    this.modal.triggerFocusRefresh++;

    apos.bus.$on('content-changed', this.onContentChanged);
    apos.bus.$on('command-menu-manager-create-new', this.create);
    apos.bus.$on('command-menu-manager-close', this.confirmAndCancel);
  },
  unmounted() {
    apos.bus.$off('content-changed', this.onContentChanged);
    apos.bus.$off('command-menu-manager-create-new', this.create);
    apos.bus.$off('command-menu-manager-close', this.confirmAndCancel);
  },
  methods: {
    moreMenuHandler(action) {
      if (action === 'new') {
        this.create();
      }
    },
    onContentChanged({ doc }) {
      if (
        !doc ||
        !doc.aposLocale ||
        doc.aposLocale.split(':')[0] === this.modalData.locale
      ) {
        this.getPages();
      }
    },
    async request (mergeOptions) {
      const options = {
        ...this.filterValues,
        ...this.queryExtras,
        ...mergeOptions,
        archived: this.relationshipField || !this.filterValues.archived ? '0' : 'any',
        all: '1',
        withPublished: 1
      };

      // Avoid undefined properties.
      const qs = Object.entries(options)
        .reduce((acc, [ key, val ]) => ({
          ...acc,
          ...val !== undefined && { [key]: val }
        }), {});

      return apos.http.get(
        this.moduleOptions.action,
        {
          qs,
          busy: true,
          draft: true
        }
      );
    },
    async getPages () {
      if (this.holdQueries) {
        // Avoid race conditions by trying again later if already in progress
        setTimeout(this.getPages, 100);
        return;
      }

      this.holdQueries = true;

      const self = this;
      try {
        this.pages = [];
        this.pagesFlat = [];

        let pageTree = await this.request({
          page: this.currentPage
        });

        // If editor is looking at the archive tree, trim the normal page tree response
        if (this.filterValues.archived) {
          pageTree = pageTree._children.find(page => page.slug === '/archive');
          pageTree = pageTree._children;
        }

        formatPage(pageTree);

        if (!pageTree.length && pageTree.length !== 0) {
          pageTree = [ pageTree ];
        }

        this.currentPage = 1;
        this.totalPages = 1;
        this.pages = [ ...pageTree ];
      } finally {
        this.holdQueries = false;
      }

      function formatPage(page) {
        if (page.length) {
          page.forEach(formatPage);
          return;
        }

        self.pagesFlat.push(klona(page));

        if (Array.isArray(page._children)) {
          page._children.forEach(formatPage);
        }
      }
    },
    getAllPagesTotal () {
      this.setAllPiecesSelection({
        isSelected: false,
        total: this.pagesFlat.length
      });
    },
    selectAllPieces () {
      this.setAllPiecesSelection({
        isSelected: true,
        docs: this.pagesFlat
      });
    },
    async update(page) {
      const body = {
        _targetId: page.endContext,
        _position: page.endIndex
      };

      const route = `${this.moduleOptions.action}/${page.changedId}`;
      try {
        await apos.http.patch(route, {
          busy: true,
          body,
          draft: true
        });
      } catch (error) {
        await apos.notify(error.body.message || this.$t('apostrophe:treeError'), {
          type: 'danger',
          icon: 'alert-circle-icon',
          dismiss: true,
          localize: false
        });
      }

      await this.getPages();
      if (this.pagesFlat.find(page => {
        return (page.aposDocId === (window.apos.page.page && window.apos.page.page.aposDocId)) && page.archived;
      })) {
        // With the current page gone, we need to move to safe ground
        location.assign(`${window.apos.prefix}/`);
      }
    },
    toggleRowCheck(id) {
      if (this.checked.includes(id)) {
        this.checked = this.checked.filter(item => item !== id);
      } else {
        this.checked = [ ...this.checked, id ];
      }
    },
    // This is not used for now
    selectAll(event) {
      if (!this.checked.length) {
        this.pagesFlat.forEach((row) => {
          this.toggleRowCheck(row._id);
        });
        return;
      }

      if (this.checked.length <= this.pagesFlat.length) {
        this.checked.forEach((id) => {
          this.toggleRowCheck(id);
        });
      }
    },
    async create() {
      const doc = await apos.modal.execute(this.moduleOptions.components.editorModal, {
        moduleName: this.moduleName,
        filterValues: this.filterValues
      });
      if (!doc) {
        // Cancel clicked
        return;
      }
      await this.getPages();
      if (this.relationshipField) {
        doc._fields = doc._fields || {};
        // Must push to checked docs or it will try to do it for us
        // and not include _fields
        this.checkedDocs.push(doc);
        this.checked.push(doc._id);
      }
    },
    setCheckedDocs(checkedDocs) {
      this.checked = checkedDocs.map(doc => doc._id);
    },
    updateCheckedDocs() {
      this.checkedDocs = this.checked.map(_id => this.pagesFlat.find(page => page._id === _id));
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
    async search(query) {
      if (query) {
        this.queryExtras.autocomplete = query;
      } else if ('autocomplete' in this.queryExtras) {
        delete this.queryExtras.autocomplete;
      } else {
        return;
      }

      this.currentPage = 1;

      await this.getPages();
    },
    async filter(filter, value) {
      if (this.filterValues[filter] === value) {
        return;
      }

      this.filterValues[filter] = value;
      this.currentPage = 1;

      await this.getPages();
      this.getAllPagesTotal();
      this.headers = this.computeHeaders();

      this.setCheckedDocs([]);
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
              messages: messages,
              type: this.checked.length === 1 ? this.moduleLabels.singular
                : this.moduleLabels.plural
            }
          });
          if (action === 'archive') {
            await this.getPages();
            this.getAllPagesTotal();
            this.checked = [];
          }
        } catch (error) {
          apos.notify('apostrophe:errorBatchOperationNoti', {
            interpolate: { operation: label },
            type: 'danger'
          });
          console.error(error);
        }
      }
    },
    computeHeaders() {
      let headers = this.options.columns || [];
      if (this.filterValues.archived) {
        headers = headers.filter(h => h.component !== 'AposCellLabels');
      }
      return headers;
    }
  }
};
