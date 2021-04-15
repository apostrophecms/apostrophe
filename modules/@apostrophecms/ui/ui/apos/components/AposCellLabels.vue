<template>
  <p
    class="apos-table__cell-field"
    :class="`apos-table__cell-field--${header.name}`"
  >
    <span v-if="item.modified">
      <AposLabel
        label="Active Draft"
      />
    </span>
    <span v-if="!item.lastPublishedAt">
      <AposLabel
        label="Unpublished"
        :modifiers="[ 'is-warning' ]"
      />
    </span>
    <span v-if="item.archived">
      <AposLabel
        label="Archived"
      />
    </span>
  </p>
</template>

<script>
export default {
  name: 'AposCellLabels',
  props: {
    item: {
      type: Object,
      required: true
    },
    header: {
      type: Object,
      required: true
    }
  },
  computed: {
  },
  methods: {

  }
};
</script>

<style lang="scss" scoped>
  .apos-table__cell-field--labels {
    text-align: right;
    padding-right: 10px;
  }
</style>
