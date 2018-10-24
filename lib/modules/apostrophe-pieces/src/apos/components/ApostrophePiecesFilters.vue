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
    console.log({ values });
    return { values };
  },
  watch: {
    values(val, oldVal) {
      console.log(oldVal, val);
      this.update();
    }
  },
  computed: {
    options() {
      return window.apos.modules[this.moduleName];
    }
  },
  methods: {
    update() {
      console.log(this.values.published);
      console.log(this.values.trash);
      this.$emit('input', this.values);
    }
  }
};
</script>
