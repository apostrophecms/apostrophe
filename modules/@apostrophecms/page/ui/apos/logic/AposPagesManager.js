// Pages manager (tree) modal business logic.

import AposModifiedMixin from 'Modules/@apostrophecms/ui/mixins/AposModifiedMixin';
import AposArchiveMixin from 'Modules/@apostrophecms/ui/mixins/AposArchiveMixin';
import AposPublishMixin from 'Modules/@apostrophecms/ui/mixins/AposPublishMixin';
import AposDocsManagerMixin from 'Modules/@apostrophecms/modal/mixins/AposDocsManagerMixin';
import { klona } from 'klona';
import { debounce, asyncTaskQueue } from 'Modules/@apostrophecms/ui/utils';

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
      currentPage: 1,
      totalPages: 1,
      pages: [],
      pagesFlat: [],
      updateQueue: asyncTaskQueue(),
      updateQueueIndex: 0,
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
      queryExtras: {
        // removed to allow per-document permissions users to see the page tree
        // viewContext: this.relationshipField ? 'relationship' : 'manage'
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
    /**
     * Extends the AposDocsManagerMixin's isModified method to check for
     * existing updates in the queue.
     *
     * @returns {boolean}
     */
    isModified() {
      // `updateQueueIndex` is a "reactive" hack,
      // because `hasTasks` is not reactive.
      if (this.updateQueueIndex > 0 && this.updateQueue.hasTasks()) {
        return true;
      }
      return this.relationshipIsModified();
    },
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
    saveRelationshipLabel() {
      if (this.relationshipField && (this.relationshipField.max === 1)) {
        return 'apostrophe:selectPage';
      } else {
        return 'apostrophe:selectPages';
      }
    },
    items() {
      if (!this.pagesFlat || !this.headers.length) {
        return [];
      }
      return klona(this.pagesFlat);
    },
    selectAllChoice() {
      const checkLen = this.checked.length;
      const rowLen = this.items.length;

      return checkLen > 0 && checkLen !== rowLen
        ? {
          value: 'checked',
          indeterminate: true
        }
        : {
          value: 'checked'
        };
    },
    canCreate() {
      const page = this.items
        .find(page => page.aposDocId === this.moduleOptions.page.aposDocId);
      if (page) {
        return page._create;
      }
      return this.moduleOptions.canCreate;
    },
    checkedTypes() {
      const types = this.checkedDocs.map(doc => doc.type);
      return [ ...new Set(types) ];
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
    onUpdate(page) {
      // A "reactive" hack, because `hasTasks` is not reactive.
      this.updateQueueIndex++;
      this.updateQueue.add(() => this.update(page))
        .then(() => {
          this.updateQueueIndex++;
        })
        .catch(() => {
          this.updateQueueIndex++;
        });
    },
    async update(page) {
      const body = {
        _targetId: page.endContext,
        _position: page.endIndex
      };

      const route = `${this.moduleOptions.action}/${page.changedId}`;
      let result;
      try {
        result = await apos.http.patch(route, {
          busy: false,
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

      // Patch returned a list of the modifications of all pages due to moving
      // the page. We need to update the tree with the changes.
      // The tree is already optimistically updated with the new position, we
      // only care to keep the state consistent.
      if (result.__changed) {
        try {
          // await new Promise(resolve => setTimeout(resolve, 3000));
          await this.updateTree(result);
          // This might interrupt the queued tasks, but it's fine.
          // We have to refresh if the current page is moved and has a new URL
          // as a consequence.
          const currentSlug = window.apos.page.page?.slug;
          const currentId = window.apos.page.page?.aposDocId;
          const currentPage = this.pagesFlat.find(page => page.aposDocId === currentId);
          if (currentPage && currentPage.slug !== currentSlug) {
            location.assign(currentPage._url);
          }
        } catch (error) {
          await apos.notify(error.body.message || this.$t('apostrophe:treeError'), {
            type: 'danger',
            icon: 'alert-circle-icon',
            dismiss: true,
            localize: false
          });
          // If the update fails, we need to refresh the tree
          // to avoid inconsistant state. This won't stop the rest of the
          // tasks in the queue, but will reset the scroll position. A small
          // price to pay for consistency.
          await this.getPages();
        }
      } else {
        await this.getPages();
      }

      if (this.items.some(page => {
        return (page.aposDocId === window.apos.page.page?.aposDocId) && page.archived;
      })) {
        // With the current page gone, we need to move to safe ground
        location.assign(`${apos.prefix}/`);
      }
    },
    // Recursively update the tree and the flat list with the changes returned
    // by the server. The `changes` array contains a list of documents with
    // only the fields that have changed. Update both draft and published documents.
    // The current document changes comes only for draft and contains the new depth,
    // updatedAt, and order. We request a fresh published document for the current
    // document to update it.
    // The rest of the changes are only the new order values for both
    // draft and published documents.
    async updateTree(updated) {
      const { __changed, ...draft } = updated;
      const changes = __changed.map(change => {
        if (change.slug) {
          return {
            ...change,
            _url: `${window.apos.prefix}${change.slug}`
          };
        }
        return change;
      });
      // Retrieve the published document version, generate a change object for it.
      const published = await apos.http.get(
        `${this.moduleOptions.action}/${draft._id.replace(':draft', ':published')}`,
        { busy: false }
      );
      const draftChange = changes.find(change => change._id === updated._id);
      const publishedChanges = Object.keys(draftChange)
        .reduce((acc, key) => {
          acc[key] = published[key];
          return acc;
        }, {});
      changes.push(publishedChanges);

      // Quick lookup for the changes
      const index = changes.reduce((acc, change, currentIndex) => {
        acc[change._id] = currentIndex;
        return acc;
      }, {});

      this.pages.forEach(updateNode);
      for (const [ i, page ] of this.pagesFlat.entries()) {
        const success = update(page, changes, index);
        if (success) {
          this.pagesFlat[i] = { ...page };
        }
      }
      this.pages = [ ...this.pages ];
      this.pagesFlat = [ ...this.pagesFlat ];

      function updateNode(node) {
        update(node, changes, index);
        if (node._children) {
          node._children.forEach(updateNode);
        }
      }

      function update(node, changes, index) {
        // Update the published document if it exists
        const publishedId = node._publishedDoc?._id;
        if (publishedId && typeof index[publishedId] !== 'undefined') {
          Object.assign(node._publishedDoc, changes[index[publishedId]]);
          node._publishedDoc = { ...node._publishedDoc };
        }
        // Update the draft document
        if (typeof index[node._id] !== 'undefined') {
          Object.assign(node, changes[index[node._id]]);
          // Any changes to the slug has to be applied, no matter
          // if the changes contain published document changes.
          // The children changes for published docs are currently
          // not reported by the server.
          if (changes[index[node._id]].slug && node._publishedDoc) {
            node._publishedDoc.slug = node.slug;
            node._publishedDoc.path = node.path;
            node._publishedDoc._url = node._url;
            node._publishedDoc = { ...node._publishedDoc };
          }
          return true;
        }

        return false;
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
        total: this.items.length
      });
    },
    selectAllPieces () {
      this.setAllPiecesSelection({
        isSelected: true,
        docs: this.items
      });
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
    computeHeaders() {
      let headers = this.options.columns || [];
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
        await this.getPages();
        this.getAllPagesTotal();
        if (action === 'archive') {
          this.checked = this.checked.filter(checkedId => doc._id !== checkedId);
        }
      }
    }
  }
};
