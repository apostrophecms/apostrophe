<template>
  <AposModal
    :modal="modal" :modal-title="modalTitle"
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
        <template #bodyMain>
          <AposTree
            :rows="rows"
            :headers="headers" :icons="icons"
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
import dayjs from 'dayjs';

export default {
  name: 'AposDocHistory',
  mixins: [ AposModalParentMixin, AposTableMixin ],
  props: {
    doc: {
      type: Object,
      required: true
    }
  },
  emits: [ 'trash', 'search', 'safe-close' ],
  data() {
    return {
      modalTitle: `${this.doc.title} Versions`,
      modal: {
        active: false,
        type: 'slide',
        showModal: false
      },
      pages: [],
      options: {
        columns: [
          {
            label: 'Page Title',
            name: 'title'
          },
          {
            label: 'Edited on',
            name: 'updatedAt',
            icon: 'calendar'
          },
          {
            label: 'Edited by',
            name: 'author',
            icon: 'pencil'
          },
          {
            label: 'Link',
            name: '_id',
            icon: 'link',
            iconOnly: true,
            type: 'button'
          }
        ]
      }
    };
  },
  computed: {
    rows() {
      const rows = [];
      if (!this.versions || !this.headers.length) {
        return [];
      }

      this.versions.forEach(page => {
        const data = {};

        this.headers.forEach(column => {
          data[column.name] = page[column.name];
          data._id = page._id;
          data.children = page._children;
        });
        rows.push(data);
      });

      return rows;
    }
  },
  async mounted() {
    this.modal.active = true;

    await this.getVersions();
  },
  methods: {
    async getVersions () {
      let docVersions = (await apos.http.post(
        '/api/v1/@apostrophecms/version/list', {
          busy: true,
          body: {
            _id: this.doc._id
          }
        }
      )).versions;

      // console.info('FLAT HISTORY: ', docVersions);
      docVersions = this.nestVersions(docVersions);
      // console.info('NESTED HISTORY: ', docVersions);

      if (docVersions) {
        this.versions = docVersions;
      }
    },
    openEditor(event) {
      console.info('OPEN DOC TO EDIT', event);
    },
    nestVersions (versions) {
      const versionsTree = [];

      versions.forEach(version => {
        const created = dayjs(version.createdAt);
        const matchIndex = versionsTree.findIndex(v => {
          return created.isSame(v.createdAt, 'day');
        });

        if (matchIndex > -1) {
          versionsTree[matchIndex]._children.push(version);
        } else {
          version._children = [];
          versionsTree.push(version);
        }
      });

      return versionsTree;
    }
  }
};
</script>

<style lang="scss" scoped>
</style>
