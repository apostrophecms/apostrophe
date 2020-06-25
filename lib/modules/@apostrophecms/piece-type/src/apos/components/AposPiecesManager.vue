<template>
  <AposModal
    :modal="modal"
    @esc="cancel" @no-modal="$emit('safe-close')"
    @inactive="modal.active = false" @show-modal="modal.showModal = true"
  >
    <template #primaryControls>
      <AposButton
        :label="`New ${ options.label }`" type="primary"
        @click="inserting = true"
      />
    </template>
    <template #main>
      <component
        :module-name="moduleName" :is="options.components.filters"
        :filters="options.filters" v-model="filterValues"
      />
      <component
        :module-name="moduleName" :is="options.components.list"
        :pieces="pieces"
      />
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

export default {
  name: 'AposPiecesManager',
  props: {
    moduleName: String
  },
  data() {
    return {
      modal: {
        title: `Manage ${this.moduleName}`,
        active: false,
        type: 'overlay',
        showModal: false
      },
      pieces: [],
      totalPages: 1,
      currentPage: 1,
      filterValues: {},
      inserting: false
    };
  },
  computed: {
    options() {
      return window.apos.modules[this.moduleName];
    }
  },
  watch: {
    filterValues: {
      deep: true,
      handler() {
        this.update();
      }
    },
    currentPage() {
      this.update();
    }
  },
  created() {
    this.options.filters.forEach(filter => {
      this.filterValues[filter.name] = filter.choices[0].value;
    });
  },
  mounted() {
    this.modal.active = true;
    this.update();
  },
  methods: {
    cancel() {
      this.modal.showModal = false;
    },
    async update() {
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
    async finishSaved() {
      await this.update();

      this.inserting = false;
    }
  }
};
</script>
