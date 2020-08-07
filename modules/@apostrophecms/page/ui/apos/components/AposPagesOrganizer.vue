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
        <template #bodyHeader />
        <template #bodyMain>
          <AposTree
            :rows="rows" :headers="headers"
            :draggable="true" :selectable="true"
            v-model="checked"
            @update="update" @busy="setBusy"
          />
        </template>
      </AposModalBody>
    </template>
  </AposModal>
</template>

<script>
import AposModalParentMixin from 'Modules/@apostrophecms/modal/mixins/AposModalParentMixin';
import AposTableMixin from 'Modules/@apostrophecms/modal/mixins/AposTableMixin';

export default {
  name: 'AposPagesOrganizer',
  mixins: [ AposModalParentMixin, AposTableMixin ],
  emits: ['trash', 'search', 'safe-close'],
  data() {
    return {
      modal: {
        active: false,
        type: 'slide',
        showModal: false
      },
      pages: [],
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
            labelIcon: 'circle-icon',
            icon: 'circle-icon'
          },
          {
            label: 'Link',
            name: '_url',
            icon: 'link-icon',
            iconOnly: true
          }
        ]
      }
    };
  },
  computed: {
    rows() {
      const rows = [];
      if (!this.pages || !this.headers.length) {
        return [];
      }

      this.pages.forEach(page => {
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
    // Get the data. This will be more complex in actuality.
    this.modal.active = true;
    this.getPages();
  },
  methods: {
    async finishSaved() {
      await this.getPages();
    },
    async getPages () {
      const pageTree = (await apos.http.get(
        '/api/v1/@apostrophecms/page', {
          busy: true,
          qs: {
            all: 1
          }
        }
      )).results;

      formatPageDates(pageTree);

      this.pages = [pageTree];

      function formatPageDates(page) {
        page.published = page.published ? 'Published' : 'Unpublished';

        if (page._children) {
          page._children.forEach(formatPageDates);
        }
      }
    },
    update(obj) {
      // We'll hit a route here to update the docs.
      console.info('CHANGED ROW:', obj);
    },
    setBusy(val) {
      console.info('Busy state is ', val);
    }
  }
};
</script>

<style lang="scss" scoped>
</style>
