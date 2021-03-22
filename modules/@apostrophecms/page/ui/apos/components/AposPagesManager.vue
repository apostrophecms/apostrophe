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
        :disabled="(relationshipErrors === 'min') || (relationshipErrors === 'max')"
        @click="saveRelationship"
      />
    </template>
    <template v-if="relationshipField" #leftRail>
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
    </template>
    <template #main>
      <AposModalBody>
        <template #bodyHeader>
          <AposDocsManagerToolbar
            :selected-state="selectAllState"
            @select-click="selectAll"
            @trash-click="trashClick"
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
          />
        </template>
      </AposModalBody>
    </template>
  </AposModal>
</template>

<script>
import AposModalModifiedMixin from 'Modules/@apostrophecms/modal/mixins/AposModalModifiedMixin';
import AposDocsManagerMixin from 'Modules/@apostrophecms/modal/mixins/AposDocsManagerMixin';
import { klona } from 'klona';

export default {
  name: 'AposPagesManager',
  mixins: [ AposModalModifiedMixin, AposDocsManagerMixin ],
  emits: [ 'trash', 'search', 'safe-close' ],
  data() {
    return {
      moduleName: '@apostrophecms/page',
      modal: {
        active: false,
        type: 'overlay',
        showModal: false
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
            columnHeader: 'Published',
            property: 'lastPublishedAt',
            cellValue: {
              true: {
                icon: 'circle',
                iconSize: 10,
                label: 'Yes',
                class: 'is-published'
              },
              false: {
                icon: 'circle',
                iconSize: 10,
                label: 'No'
              }
            }
          },
          {
            columnHeader: 'Edit',
            property: '_id',
            type: 'button',
            action: 'edit',
            cellValue: {
              icon: 'pencil'
            }
          },
          {
            columnHeader: 'Link',
            property: '_url',
            type: 'link',
            cellValue: {
              icon: 'link'
            }
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
            all: 1,
            trash: null
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
    trashClick() {
      // TODO: Trigger a confirmation modal and execute the deletion.
      this.$emit('trash', this.selected);
    },
    async openEditor(pageId) {
      const doc = await apos.modal.execute(this.moduleOptions.components.insertModal, {
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
    height: 100%;
    padding: 20px;
    background-color: var(--a-base-9);
  }

  .apos-pages-manager__relationship__counts {
    margin-bottom: 20px;
  }
</style>
