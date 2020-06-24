<template>
  <ApostropheModal @close="$emit('close')">
    <template #header>
      <!-- TODO i18n -->
      <p>Manage {{ options.pluralLabel }}</p>
      <button @click="inserting = true">
        New {{ options.label }}
      </button>
    </template>
    <template #body>
      <component
        :module-name="moduleName" :is="options.components.filters"
        :filters="options.filters" v-model="filterValues"
      />
      <component
        :module-name="moduleName" :is="options.components.list"
        :pieces="pieces"
      />
    </template>
    <template #footer>
      <!-- <component :is="options.components.pager" :totalPages="totalPages" v-model="currentPage" v-on/> -->
      <component
        v-if="inserting" :module-name="moduleName"
        :is="options.components.insertModal" @close="inserting = false"
        @saved="update(); inserting = false"
      />
    </template>
  </ApostropheModal>
</template>

<script>

export default {
  name: 'ApostrophePiecesManagerModal',
  props: {
    moduleName: String
  },
  data() {
    return {
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
    this.update();
  },
  methods: {
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
        )).pieces;
      } finally {
        apos.bus.$emit('busy', false);
      }
    },
    insert() {

    }
  }
};
</script>
