<template>
  <ApostropheModal @close="$emit('close')">
    <template slot="header">
      <!-- TODO i18n -->
      Manage {{ options.pluralLabel }}
    </template>
    <template slot="body">
      <component :moduleName="moduleName" :is="options.components.filters" :filters="options.filters" :filterChoices="filterChoices" v-model="filterValues" @input="updateFilterValues" />
      <component :moduleName="moduleName" :is="options.components.list" :pieces="pieces" />
    </template>
    <template slot="footer">
      <!-- <component :is="options.components.pager" :totalPages="totalPages" v-model="currentPage" v-on/> -->
    </template>
  </ApostropheModal>
</template>

<script>
import axios from 'axios';
import cookies from 'js-cookie';

export default {
  name: 'ApostrophePiecesManagerModal',
  props: {
    moduleName: String
  },
  computed: {
    options() {
      return window.apos.modules[this.moduleName];
    }
  },
  data() {
    return {
      pieces: [],
      totalPages: 1,
      currentPage: 1,
      filterChoices: {},
      filterValues: {}
    }
  },
  watch: {
    filterValues(val, oldVal) {
      update();
    },
    currentPage(val, oldVal) {
      update();
    }
  },
  async mounted() {
    apos.bus.$emit('busy', true);
    try {
      this.pieces = (await axios.create({
        headers: {
          'X-XSRF-TOKEN': cookies.get(window.apos.csrfCookieName)
        }
      }).post(
        this.options.action + '/list',
        {
          filters: {
            ...this.filterValues,
            page: this.currentPage
          }
        }
      )).data.pieces;
      console.log(this.pieces);
    } finally {
      apos.bus.$emit('busy', false);
    }
  },
  methods: {
    update() {
      // Go get things, in a debounced way
    },
    updateFilterValues(values) {
      filterValues = values;
    }
  }
};
</script>
