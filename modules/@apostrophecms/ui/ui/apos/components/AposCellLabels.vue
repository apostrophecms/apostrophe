<template>
  <p
    class="apos-table__cell-field apos-table__cell-field--labels"
    :class="`apos-table__cell-field--${header.name}`"
  >
    <span v-if="item.modified">
      <AposLabel
        label="Active Draft" class="apos-table__cell-field__label"
      />
    </span>
    <span v-if="!item.lastPublishedAt">
      <AposLabel
        label="Unpublished" class="apos-table__cell-field__label"
        :modifiers="[ 'is-warning' ]"
      />
    </span>
    <span v-if="item.archived">
      <AposLabel
        label="Archived" class="apos-table__cell-field__label"
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
  }
};
</script>

<style lang="scss" scoped>
  .apos-table__cell-field--labels {
    display: inline-flex;
    padding-right: 10px;
  }
  .apos-table__cell-field__label {
    margin-left: 5px;
  }
</style>
