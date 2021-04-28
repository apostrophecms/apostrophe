<template>
  <AposModal
    :modal="modal" modal-title="Manage Page Tree"
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
        type="default" label="Exit"
        @click="confirmAndCancel"
      />
    </template>
    <template #primaryControls>
      <AposContextMenu
        v-if="relationshipField"
        :menu="moreMenu"
        menu-placement="bottom-end"
        @item-clicked="moreMenuHandler"
        :button="moreMenuButton"
      />
      <AposButton
        v-else type="primary"
        label="New Page" @click="openEditor(null)"
      />
      <AposButton
        v-if="relationshipField"
        type="primary"
        :label="saveRelationshipLabel"
        :disabled="!!relationshipErrors"
        @click="saveRelationship"
      />
    </template>
    <template v-if="relationshipField" #leftRail>
      <AposModalRail>
        <div class="apos-pages-manager__relationship__rail">
          <div class="apos-pages-manager__relationship__counts">
            <AposMinMaxCount
              :field="relationshipField"
              :value="checkedDocs"
            />
          </div>
          <AposSlatList
            class="apos-pages-manager__relationship__items"
            @input="setCheckedDocs"
            :value="checkedDocs"
          />
        </div>
      </AposModalRail>
    </template>
    <template #main>
      <AposModalBody>
        <template #bodyHeader>
          <AposModalToolbar>
            <template #rightControls>
              <AposContextMenu
                :menu="pageSetMenu"
                menu-placement="bottom-end"
                @item-clicked="pageSetMenuSelection = $event"
                :button="pageSetMenuButton"
              />
            </template>
          </AposModalToolbar>
        </template>
        <template #bodyMain>
          <AposTree
            :items="items"
            :headers="headers"
            :icons="icons"
            v-model="checked"
            :options="treeOptions"
            @update="update"
            @edit="openEditor"
            @preview="onPreview"
            @copy="copy"
            @archive="onArchive"
            @restore="onRestore"
            @discard-draft="onDiscardDraft"
            @dismiss-submission="onDismissSubmission"
          />
        </template>
      </AposModalBody>
    </template>
  </AposModal>
</template>

<script>
import AposModalModifiedMixin from 'Modules/@apostrophecms/modal/mixins/AposModalModifiedMixin';
import AposArchiveMixin from 'Modules/@apostrophecms/ui/mixins/AposArchiveMixin';
import AposPublishMixin from 'Modules/@apostrophecms/ui/mixins/AposPublishMixin';
import AposDocsManagerMixin from 'Modules/@apostrophecms/modal/mixins/AposDocsManagerMixin';
import { klona } from 'klona';

export default {
  name: 'AposPagesManager',
  mixins: [ AposModalModifiedMixin, AposDocsManagerMixin, AposArchiveMixin, AposPublishMixin ],
  emits: [ 'archive', 'search', 'safe-close', 'modal-result' ],
  data() {

    return {
      moduleName: '@apostrophecms/page',
      modal: {
        active: false,
        type: 'slide',
        showModal: false,
        width: 'two-thirds'
      },
      pages: [],
      pagesFlat: [],
      options: {
        columns: [
          {
            columnHeader: 'Page Title',
            property: 'title',
            cellValue: 'title'
          },
          {
            name: 'labels',
            columnHeader: '',
            component: 'AposCellLabels'
          },
          {
            columnHeader: 'Last Edited',
            property: 'updatedAt',
            component: 'AposCellLastEdited',
            cellValue: 'updatedAt'
          },
          {
            columnHeader: '',
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
      return this.options.columns || [];
    },
    pageSetMenu() {
      const isLive = this.pageSetMenuSelection === 'live';
      return [ {
        label: 'Live',
        action: 'live',
        modifiers: isLive ? [ 'selected', 'disabled' ] : []
      }, {
        label: 'Archive',
        action: 'archive',
        modifiers: !isLive ? [ 'selected', 'disabled' ] : []
      } ];
    },
    pageSetMenuButton() {
      const isLive = this.pageSetMenuSelection === 'live';
      const button = {
        label: isLive ? 'Live' : 'Archive',
        icon: 'chevron-down-icon',
        modifiers: [ 'no-motion', 'outline', 'icon-right' ],
        class: 'apos-pages-manager__page-set-menu-button'
      };
      return button;
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
    apos.bus.$on('content-changed', this.getPages);
  },
  destroyed() {
    apos.bus.$off('content-changed', this.getPages);
  },
  methods: {
    onPreview(id) {
      this.preview(this.findDocById(this.pagesFlat, id));
    },
    async onArchive(id) {
      const doc = this.findDocById(this.pagesFlat, id);
      if (await this.archive(doc)) {
        await this.getPages();
      }
    },
    async onRestore(id) {
      const doc = this.findDocById(this.pagesFlat, id);
      if (await this.restore(doc)) {
        await this.getPages();
      }
    },
    async onDiscardDraft(id) {
      const doc = this.findDocById(this.pagesFlat, id);
      if (await this.discardDraft(doc)) {
        await this.getPages();
      }
    },
    async onDismissSubmission(id) {
      const doc = this.findDocById(this.pagesFlat, id);
      if (await this.dismissSubmission(doc)) {
        await this.getPages();
      }
    },
    async copy(id) {
      const doc = await apos.modal.execute(this.moduleOptions.components.editorModal, {
        moduleName: this.moduleName,
        copyOf: this.findDocById(this.pagesFlat, id)
      });
      if (!doc) {
        return;
      }
      await this.getPages();
    },
    moreMenuHandler(action) {
      if (action === 'new') {
        this.openEditor(null);
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
              archived: this.relationshipField || this.pageSetMenuSelection === 'live' ? '0' : 'any'
            },
            draft: true
          }
        ));

        // If editor is looking at the archive tree, trim the normal page tree response
        if (this.pageSetMenuSelection === 'archive') {
          pageTree = pageTree._children.find(page => page.slug === '/archive');
        }

        formatPage(pageTree);

        this.pages = [ pageTree ];
      } finally {
        this.gettingPages = false;
      }

      function formatPage(page) {
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
        await apos.notify(error.body.message || 'An error occurred while updating the page tree.', {
          type: 'danger',
          icon: 'alert-circle-icon',
          dismiss: true
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
    archiveClick() {
      // TODO: Trigger a confirmation modal and execute the deletion.
      this.$emit('archive', this.selected);
    },
    async openEditor(pageId) {
      const doc = await apos.modal.execute(this.moduleOptions.components.editorModal, {
        moduleName: this.moduleName,
        docId: pageId
      });
      if (!doc) {
        // Cancel clicked
        return;
      }
      await this.getPages();
      if (this.relationshipField && (!pageId)) {
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
</script>

<style lang="scss" scoped>
  .apos-pages-manager__relationship__rail {
    padding: 20px;
  }

  .apos-pages-manager__relationship__counts {
    margin-bottom: 20px;
  }
</style>
