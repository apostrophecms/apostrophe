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
        type="default" label="Finished"
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
          <AposDocsManagerToolbar
            :selected-state="selectAllState"
            @select-click="selectAll"
            @archive-click="archiveClick"
            :options="{
              noSearch: true,
              noPager: true,
              hideSelectAll: !relationshipField
            }"
          />
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
          />
        </template>
      </AposModalBody>
    </template>
  </AposModal>
</template>

<script>
import AposModalModifiedMixin from 'Modules/@apostrophecms/modal/mixins/AposModalModifiedMixin';
import AposArchiveMixin from 'Modules/@apostrophecms/ui/mixins/AposArchiveMixin';
import AposDocsManagerMixin from 'Modules/@apostrophecms/modal/mixins/AposDocsManagerMixin';
import { klona } from 'klona';

export default {
  name: 'AposPagesManager',
  mixins: [ AposModalModifiedMixin, AposDocsManagerMixin, AposArchiveMixin ],
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
      }
    };
  },
  computed: {
    moduleOptions() {
      return apos.page;
    },
    items() {
      const items = [];
      if (!this.pages || !this.headers.length) {
        return [];
      }

      const pagesSet = klona(this.pages);

      pagesSet.forEach(page => {
        const data = {};

        this.headers.forEach(column => {
          data[column.property] = page[column.property];
          data._id = page._id;
          data.children = page.children;
          data.parked = page.parked;
        });
        items.push(data);
      });
      return items;
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
    }
  },
  async mounted() {
    // Get the data. This will be more complex in actuality.
    this.modal.active = true;
    await this.getPages();
  },
  methods: {
    onPreview(id) {
      this.preview(this.findDocById(this.pagesFlat, id));
    },
    async onArchive(id) {
      const doc = this.findDocById(this.pagesFlat, id);
      if (await this.archive(this.moduleOptions.action, id, !!doc.lastPublishedAt, true)) {
        await this.getPages();
      }
    },
    async onRestore(id) {
      if (await this.restore(this.moduleOptions.action, id, true)) {
        await this.getPages();
      }
    },
    async copy(id) {
      const doc = await apos.modal.execute(this.moduleOptions.components.insertModal, {
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
      this.pages = [];
      this.pagesFlat = [];
      const self = this;

      const pageTree = (await apos.http.get(
        '/api/v1/@apostrophecms/page', {
          busy: true,
          qs: {
            all: '1',
            archived: this.relationshipField ? '0' : 'any'
          },
          draft: true
        }
      ));

      formatPage(pageTree);

      this.pages = [ pageTree ];

      function formatPage(page) {
        self.pagesFlat.push(klona(page));

        page.children = page._children;
        delete page._children;

        if (Array.isArray(page.children)) {
          page.children.forEach(formatPage);
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
