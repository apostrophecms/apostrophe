<template>
  <ApostropheModal @close="$emit('close')">
    <template slot="header">
      <!-- TODO i18n -->
      Manage {{ label }}
    </template>
    <template slot="body">
      <component :is="components.Filters" :filters="options.filters" :filterChoices="filterChoices" v-model="filterValues" />
      <component :is="components.List" :pieces="pieces" />
    </template>
    <template slot="footer">
      <component :is="components.Pager" :totalPages="totalPages" v-model="currentPage" v-on/>
    </template>
  </ApostropheModal>
</template>

<script>
export default {
  name: 'ApostrophePiecesManagerModal',
  props: {
    options: Object
  },
  computed: {
    label() {
      return apos.modules[this.options.moduleName].pluralLabel;
    }
  },
  data: {
    pieces: [],
    totalPages: 1,
    currentPage: 1,
    filterChoices: {},
    filterValues: {}
  },
  watch: {
    filterValues: function(val, oldVal) {
      update();
    },
    currentPage: function(val, oldVal) {
      update();
    }
  },
  methods: {
    update: function() {
      // Go get things, in a debounced way
    }
  }
};
</script>
