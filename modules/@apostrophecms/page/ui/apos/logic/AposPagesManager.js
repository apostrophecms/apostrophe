// Pages manager (tree) modal business logic.

import AposModifiedMixin from 'Modules/@apostrophecms/ui/mixins/AposModifiedMixin';
import AposArchiveMixin from 'Modules/@apostrophecms/ui/mixins/AposArchiveMixin';
import AposPublishMixin from 'Modules/@apostrophecms/ui/mixins/AposPublishMixin';
import AposDocsManagerMixin from 'Modules/@apostrophecms/modal/mixins/AposDocsManagerMixin';
import { klona } from 'klona';

export default {
  name: 'AposPagesManager',
  mixins: [ AposModifiedMixin, AposDocsManagerMixin, AposArchiveMixin, AposPublishMixin ],
  emits: [ 'archive', 'search', 'safe-close', 'modal-result' ],
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
      treeOptions: {
        bulkSelect: !!this.relationshipField,
        draggable: true,
        ghostUnpublished: true
      },
      moreMenu: [
        {
          label: 'New Page',
          action: 'new'
        }
      ],
      moreMenuButton: {
        tooltip: {
          content: 'More Options',
          placement: 'bottom'
        },
        label: 'More Options',
        icon: 'dots-vertical-icon',
        iconOnly: true,
        type: 'subtle',
        modifiers: [ 'small', 'no-motion' ]
      },
      pageSetMenuSelection: 'live'
    };
  },
  computed: {
    moduleOptions() {
      return apos.page;
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
        return 'Select Page';
      } else {
        return 'Select Pages';
      }
    },
    headers() {
      let headers = this.options.columns || [];
      if (!this.pageSetMenuSelectionIsLive) {
        headers = headers.filter(h => h.component !== 'AposCellLabels');
      }
      return headers;
    },
    pageSetMenu() {
      return [ {
        label: 'apostrophe:live',
        action: 'live',
        modifiers: this.pageSetMenuSelectionIsLive ? [ 'selected', 'disabled' ] : []
      }, {
        label: 'apostrophe:archived',
        action: 'archive',
        modifiers: !this.pageSetMenuSelectionIsLive ? [ 'selected', 'disabled' ] : []
      } ];
    },
    pageSetMenuButton() {
      const button = {
        label: this.pageSetMenuSelectionIsLive ? 'apostrophe:live' : 'apostrophe:archived',
        icon: 'chevron-down-icon',
        modifiers: [ 'no-motion', 'outline', 'icon-right' ],
        class: 'apos-pages-manager__page-set-menu-button'
      };
      return button;
    },
    pageSetMenuSelectionIsLive() {
      return this.pageSetMenuSelection === 'live';
    }
  },
  watch: {
    async pageSetMenuSelection() {
      await this.getPages();
    }
  },
  async mounted() {
    // Get the data. This will be more complex in actuality.
    this.modal.active = true;
    await this.getPages();
    this.modal.triggerFocusRefresh++;

    apos.bus.$on('content-changed', this.getPages);
    apos.bus.$on('command-menu-manager-create-new', this.create);
    apos.bus.$on('command-menu-manager-close', this.confirmAndCancel);
  },
  destroyed() {
    apos.bus.$off('content-changed', this.getPages);
    apos.bus.$off('command-menu-manager-create-new', this.create);
    apos.bus.$off('command-menu-manager-close', this.confirmAndCancel);
  },
  methods: {
    moreMenuHandler(action) {
      if (action === 'new') {
        this.create();
      }
    },
    async getPages () {
      const self = this;
      if (this.gettingPages) {
        // Avoid race conditions by trying again later if already in progress
        setTimeout(this.getPages, 100);
        return;
      }
      // Not reactive, so not in data()
      this.gettingPages = true;
      try {
        this.pages = [];
        this.pagesFlat = [];

        let pageTree = (await apos.http.get(
          '/api/v1/@apostrophecms/page', {
            busy: true,
            qs: {
              all: '1',
              archived: this.relationshipField || this.pageSetMenuSelectionIsLive ? '0' : 'any',
              // Also fetch published docs as _publishedDoc subproperties
              withPublished: 1
            },
            draft: true
          }
        ));

        // If editor is looking at the archive tree, trim the normal page tree response
        if (this.pageSetMenuSelection === 'archive') {
          pageTree = pageTree._children.find(page => page.slug === '/archive');
          pageTree = pageTree._children;
        }

        formatPage(pageTree);

        if (!pageTree.length && pageTree.length !== 0) {
          pageTree = [ pageTree ];
        }

        this.pages = [ ...pageTree ];

      } finally {
        this.gettingPages = false;
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
        this.checked.push(id);
      }
    },
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
        moduleName: this.moduleName
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
    }
  }
};
