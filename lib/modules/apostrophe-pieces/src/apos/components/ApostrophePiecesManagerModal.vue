<template>
  <ApostropheModal @close="$emit('close')">
    <template slot="header">
      <!-- TODO i18n -->
      <p>Manage {{ options.pluralLabel }}</p>
      <button @click="inserting = true">New {{ options.label }}</button>
    </template>
    <template slot="body">
      <component :moduleName="moduleName" :is="options.components.filters" :filters="options.filters" v-model="filterValues" />
      <component :moduleName="moduleName" :is="options.components.list" :pieces="pieces" />
    </template>
    <template slot="footer">
      <!-- <component :is="options.components.pager" :totalPages="totalPages" v-model="currentPage" v-on/> -->
     <component v-if="inserting" :moduleName="moduleName" :is="options.components.insertModal" @close="inserting = false" @saved="update(); inserting = false" />
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
      filterValues: {},
      inserting: false
    };
  },
  created() {
    this.options.filters.forEach(filter => {
      this.filterValues[filter.name] = filter.choices[0].value;
    });
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
  mounted() {
    this.update();
  },
  methods: {
    async update() {
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
      } finally {
        apos.bus.$emit('busy', false);
      }
    },
    insert() {

    }
  }
};
</script>
