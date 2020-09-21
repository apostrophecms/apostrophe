<template>
  <AposModal
    :modal="modal" :modal-title="modalTitle"
    @esc="cancel" @no-modal="$emit('safe-close')"
    @inactive="modal.active = false" @show-modal="modal.showModal = true"
  >
    <template #secondaryControls>
      <AposButton
        type="default" label="Exit"
        @click="cancel"
      />
    </template>
    <template #primaryControls>
      <AposButton
        type="primary" :label="restoreLabel"
        @click="restore" :disabled="latestVersion === selected[0]"
      />
    </template>
    <template #main>
      <AposModalBody>
        <template #bodyMain>
          <AposTree
            :items="rows" :headers="headers"
            :icons="icons" :options="treeOptions"
            v-model="selected"
          />
        </template>
      </AposModalBody>
    </template>
  </AposModal>
</template>

<script>
import AposModalParentMixin from 'Modules/@apostrophecms/modal/mixins/AposModalParentMixin';
import AposManagerMixin from 'Modules/@apostrophecms/modal/mixins/AposManagerMixin';
import dayjs from 'dayjs';

export default {
  name: 'AposDocVersions',
  mixins: [ AposModalParentMixin, AposManagerMixin ],
  props: {
    doc: {
      type: Object,
      required: true
    }
  },
  emits: [ 'trash', 'search', 'safe-close' ],
  data() {
    return {
      modalTitle: 'Version History',
      modal: {
        active: false,
        type: 'slide',
        showModal: false,
        a11yTitle: this.doc.title
      },
      versions: [],
      latestVersion: '',
      selected: [],
      options: {
        columns: [
          {
            label: 'Edited on',
            name: 'editedAt',
            labelIcon: 'calendar'
          },
          {
            label: 'Edited by',
            name: 'author',
            labelIcon: 'account-box'
          }
        ]
      },
      treeOptions: {
        hideHeader: true,
        selectable: true,
        startCollapsed: true
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
          data.children = page.children;
        });
        rows.push(data);
      });

      return rows;
    },
    restoreLabel() {
      return this.latestVersion === this.selected[0] ? 'Current version' : 'Restore';
    }
  },
  async mounted() {
    this.modal.active = true;

    await this.getVersions();
    this.selected = [ this.versions[0]._id ];
    this.latestVersion = this.versions[0]._id;
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

      docVersions = this.formatVersions(docVersions);

      if (docVersions) {
        this.versions = docVersions;
      }
    },
    restore() {
      // TEMP: This will hit a POST or PATCH route in UI integration.
      // After a confirmation step, this should also trigger `cancel`.
      console.info(`Restore version ${this.selected[0]} for doc ${this.doc._id}`);
    },
    // TODO: Confirm we still need this `openEditor`. It doesn't seem used.
    openEditor(event) {
      console.info('OPEN DOC TO EDIT', event);
    },
    formatVersions (versions) {
      const versionsTree = [];

      versions.forEach(version => {
        version.title = version.doc.title;

        const created = dayjs(version.createdAt);
        const matchIndex = versionsTree.findIndex(v => {
          return created.isSame(v.createdAt, 'day');
        });

        version.editedAt = this.formatDate(version.createdAt);
        version.author = version.author || '👻';

        if (matchIndex > -1) {
          versionsTree[matchIndex].children.push(version);
        } else {
          version.children = [];
          versionsTree.push(version);
        }
      });

      return versionsTree;
    },
    formatDate(rawDate) {
      return dayjs(rawDate).format('YYYY-MM-DD [at] H:mma');
    }
  }
};
</script>

<style lang="scss" scoped>
</style>
