<template>
  <AposModal
    :modal="modal" :modal-title="moduleTitle"
    @esc="cancel" @no-modal="$emit('safe-close')"
    @inactive="modal.active = false" @show-modal="modal.showModal = true"
  >
    <template #primaryControls>
      <AposButton
        type="default" label="Finished"
        @click="cancel"
      />
      <AposButton
        :label="`New ${ options.label }`" type="primary"
        @click="inserting = true"
      />
    </template>
    <template #main>
      <AposModalBody>
        <template #bodyHeader v-if="!!pieces.length">
          <!-- <AposPiecesManagerToolbar
            :selected-state="selectAllState"
            @select-click="selectAll"
            @trash-click="trashClick"
            @search="search"
          /> -->
          <component
            :module-name="moduleName" :is="options.components.filters"
            :filters="options.filters" v-model="filterValues"
          />
        </template>
        <template #bodyMain>
          <component
            :module-name="moduleName" :is="options.components.list"
            :pieces="pieces"
          />
        </template>
      </AposModalBody>
      <!-- TODO: Trigger the piecesEditor another way. -->
      <component
        v-if="inserting" :module-name="moduleName"
        :is="options.components.insertModal" @close="inserting = false"
        @saved="finishSaved"
      />
    </template>
  </AposModal>
</template>

<script>
import AposTableMixin from '../../../../modals/mixins/AposTableMixin';

export default {
  name: 'AposPiecesManager',
  mixins: [ AposTableMixin ],
  props: {
    moduleName: {
      type: String,
      required: true
    }
  },
  data() {
    return {
      modal: {
        active: false,
        type: 'overlay',
        showModal: false
      },
      pieces: [],
      lastSelected: null,
      totalPages: 1, // TODO: Make use of these.
      currentPage: 1, // TODO: Make use of these.
      filterValues: {}, // TODO: Make use of these.
      inserting: false // TODO: Make use of these.
    };
  },
  computed: {
    options() {
      return window.apos.modules[this.moduleName];
    },
    moduleLabels() {
      console.info(this.options);
      return {
        singular: this.options.label,
        plural: this.options.pluralLabel
      };
    },
    moduleTitle () {
      return `Manage ${this.moduleLabels.plural}`;
    },
    // headers:
    rows() {
      const rows = [];
      if (!this.pieces || !this.headers.length) {
        return [];
      }
      console.log(this.pieces);
      this.pieces.forEach(piece => {
        const data = [];

        this.headers.forEach(column => {
          data.push(piece[column.name]);
        });
        rows.push(data);
      });

      return rows;
    },
    emptyDisplay() {
      return {
        title: `No ${this.moduleLabels.plural || this.moduleLabels.singular} Found`,
        message: '',
        emoji: '📄'
      };
    },
    selectAllState() {
      if (this.selectAllValue.data.length && !this.selectAllChoice.indeterminate) {
        return 'checked';
      }
      if (this.selectAllValue.data.length && this.selectAllChoice.indeterminate) {
        return 'indeterminate';
      }
      return 'empty';
    }
  },
  // TODO: Work these back into the toolbar.
  // watch: {
  //   filterValues: {
  //     deep: true,
  //     handler() {
  //       this.update();
  //     }
  //   },
  //   currentPage() {
  //     this.update();
  //   }
  // },
  // created() {
  //   this.options.filters.forEach(filter => {
  //     this.filterValues[filter.name] = filter.choices[0].value;
  //   });
  // },
  async mounted() {
    // Get the data. This will be more complex in actuality.
    this.modal.active = true;
    this.getPieces();
  },
  methods: {
    cancel() {
      this.modal.showModal = false;
    },
    async update() {
    },
    async finishSaved() {
      await this.update();

      this.inserting = false;
    },
    async getPieces () {
      apos.bus.$emit('busy', true);

      try {
        this.pieces = (await apos.http.get(
          this.options.action, {
            qs: {
              ...this.filterValues,
              page: this.currentPage
            }
          }
        )).results;
      } finally {
        apos.bus.$emit('busy', false);
      }
    },
    // Toolbar handlers
    // TODO stub
    trashClick() {
      this.$emit('trash', this.selected);
    },
    search(query) {
      // TODO stub
      this.$emit('search', query);
    }
  }
};
</script>

<style lang="scss" scoped>
  @import '../../../../ui/scss/shared/_tables';
  // TODO: .apos-pieces-manager__empty is shared with
  // `apos-media-manager__empty`. We should combine somehow.
  .apos-pieces-manager__empty {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
    height: 100%;
    margin-top: 130px;
  }
</style>
