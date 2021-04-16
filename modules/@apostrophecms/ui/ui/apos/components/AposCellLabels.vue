<template>
  <p
    class="apos-table__cell-field apos-table__cell-field--labels"
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
    display: inline-flex;
    padding-right: 10px;
    & /deep/ .apos-label {
      margin-left: 5px;
    }
  }

</style>
