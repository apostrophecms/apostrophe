<template>
  <div class="apos-filters">
    <h4>Filters</h4>
    <fieldset v-for="filter in filters">
      <label>{{ filter.label }}</label>
      <select v-model="values[filter.name]">
        <option v-for="choice in filter.choices" :value="choice.value">{{ choice.label }}</option>
      </select>
    </fieldset>
  </div>
</template>

<script>
export default {
  name: 'ApostrophePiecesFilters',
  props: {
    moduleName: String,
    filters: Array
  },
  data() {
    const values = {};
    this.filters.forEach(filter => {
      values[filter.name] = filter.choices[0].value;
    });
    return { values };
  },
  watch: {
    // Per rideron89 we must use a "deep" watcher because
    // we are interested in subproperties
    values: {
      deep: true,
      handler(val, oldVal) {
        this.update();
      }
    }
  },
  computed: {
    options() {
      return window.apos.modules[this.moduleName];
    }
  },
  methods: {
    update() {
      this.$emit('input', this.values);
    }
  }
};
</script>
