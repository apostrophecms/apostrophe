<template>
  <div class="apos-filters">
    <h4>Filters</h4>
    <fieldset v-for="filter in filters">
      <label>{{ filter.label }}</label>
      <select v-model="next[filter.name]">
        <option v-for="choice in filter.choices" :value="choice.value">{{ choice.label }}</option>
      </select>
    </fieldset>
  </div>
</template>

<script>
// ApostrophePicesFilters is designed to be bound via
// `v-model` to an object property containing the
// initial values of various filters. This implicitly
// passes the `value` prop, you do not have to do that.
//
// `filters` contains an array of filter objects with
// `name`, `label` and `choices` properties.
//
// So this is essentially a "collection of select dropdowns"
// component that supports data binding just like ordinary
// DOM elements would.
//
// Functionality is expected to grow to accommodate
// additional use cases that may require access to the
// module settings, thus the `moduleName` prop.

export default {
  name: 'ApostrophePiecesFilters',
  props: {
    value: Object,
    moduleName: String,
    filters: Array
  },
  data() {
    const next = {};
    this.filters.forEach(filter => {
      next[filter.name] = this.value[filter.name];
    });
    return { next };
  },
  watch: {
    // Per rideron89 we must use a "deep" watcher because
    // we are interested in subproperties
    next: {
      deep: true,
      handler(val, oldVal) {
        this.$emit('input', this.next);
      }
    }
  },
  computed: {
    options() {
      return window.apos.modules[this.moduleName];
    }
  }
};
</script>
