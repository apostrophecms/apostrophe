<template>
  <div class="apos-filters">
    <h4>Filters</h4>
    <fieldset v-for="filter in filters">
      <label>{{ filter.label }}</label>
      <select :ref="filter.name" @input="update()">
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
  computed: {
    options() {
      return window.apos.modules[this.moduleName];
    }
  },
  methods: {
    update() {
      const value = {};
      this.filters.forEach(filter => {
        value[filter.name] = this.$refs[filter.name].value
      });
      this.$emit('input', value);
    }
  }
};
</script>
