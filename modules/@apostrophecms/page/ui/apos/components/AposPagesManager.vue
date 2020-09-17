<template>
  <AposModal
    :modal="modal" modal-title="Manage Page Tree"
    @esc="cancel" @no-modal="$emit('safe-close')"
    @inactive="modal.active = false" @show-modal="modal.showModal = true"
  >
    <template #primaryControls>
      <AposButton
        type="default" label="Finished"
        @click="cancel"
      />
    </template>
    <template #main>
      <AposModalBody>
        <template #bodyHeader>
          <AposPagesManagerToolbar
            :selected-state="selectAllState"
            @select-click="selectAll"
            @trash-click="trashClick"
          />
        </template>
        <template #bodyMain>
          <AposTree
            :rows="rows"
            :headers="headers" :icons="icons"
            v-model="checked"
            :options="treeOptions"
            @update="update" @busy="setBusy"
            @edit="openEditor"
          />
        </template>
      </AposModalBody>
    </template>
  </AposModal>
</template>

<script>
import AposModalParentMixin from 'Modules/@apostrophecms/modal/mixins/AposModalParentMixin';
import AposTableMixin from 'Modules/@apostrophecms/modal/mixins/AposTableMixin';
import klona from 'klona';

export default {
  name: 'AposPagesManager',
  mixins: [ AposModalParentMixin, AposTableMixin ],
  emits: [ 'trash', 'search', 'safe-close' ],
  data() {
    return {
      modal: {
        active: false,
        type: 'slide',
        showModal: false
      },
      pages: [],
      pagesFlat: [],
      checked: [],
      options: {
        columns: [
          {
            label: 'Page Title',
            name: 'title'
          },
          {
            label: 'Published',
            name: 'published',
            labelIcon: 'circle',
            icon: 'circle'
          },
          {
            label: 'Edit',
            name: '_id',
            icon: 'pencil',
            iconOnly: true,
            type: 'button',
            action: 'edit'
          },
          {
            label: 'Link',
            name: '_url',
            icon: 'link',
            iconOnly: true,
            type: 'link'
          }
        ]
      },
      treeOptions: {
        bulkSelect: true,
        draggable: true
      }
    };
  },
  computed: {
    rows() {
      const rows = [];
      if (!this.pages || !this.headers.length) {
        return [];
      }

      const pagesSet = klona(this.pages);

      pagesSet.forEach(page => {
        const data = {};

        this.headers.forEach(column => {
          data[column.name] = page[column.name];
          data._id = page._id;
          data.children = page.children;
        });
        rows.push(data);
      });

      return rows;
    },
    selectAllState() {
      if (this.selectAllValue.data.length && !this.selectAllChoice.indeterminate) {
        return 'checked';
      }
      if (this.selectAllValue.data.length && this.selectAllChoice.indeterminate) {
        return 'indeterminate';
      }
      return 'empty';
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
    }
  },
  async mounted() {
    // Get the data. This will be more complex in actuality.
    this.modal.active = true;

    await this.getPages();
  },
  methods: {
    async getPages () {
      this.pages = [];
      this.pagesFlat = [];
      const self = this;

      const pageTree = (await apos.http.get(
        '/api/v1/@apostrophecms/page', {
          busy: true,
          qs: {
            all: 1
          }
        }
      )).results;

      formatPage(pageTree);

      this.pages = [ pageTree ];

      function formatPage(page) {
        page.published = page.published ? 'Published' : 'Unpublished';
        self.pagesFlat.push({
          title: page.title,
          id: page._id
        });

        page.children = page._children;
        delete page._children;

        if (Array.isArray(page.children)) {
          page.children.forEach(formatPage);
        }
      }
    },
    update(obj) {
      // We'll hit a route here to update the docs.
      console.info('CHANGED ROW:', obj);
    },
    generateCheckboxes () {
      const checkboxes = {};
      this.pagesFlat.forEach((row) => {
        checkboxes[row.id] = {
          status: {},
          value: {
            data: []
          },
          choice: { value: row.id },
          field: {
            name: row.id,
            type: 'checkbox',
            hideLabel: true,
            label: `Toggle selection of ${row.title}`
          }
        };
      });
      this.checkboxes = checkboxes;
    },
    setBusy(val) {
      apos.bus.$emit('busy', val);
    },
    selectAll(event) {
      if (!this.checked.length) {
        this.pagesFlat.forEach((row) => {
          this.toggleRowCheck(row.id);
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
    openEditor(page) {
      console.info('📝 EDIT PAGE', page);
    }
  }
};
</script>

<style lang="scss" scoped>
</style>
