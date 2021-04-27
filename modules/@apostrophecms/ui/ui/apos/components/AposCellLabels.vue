<template>
  <p
    class="apos-table__cell-field apos-table__cell-field--labels"
    :class="`apos-table__cell-field--${header.name}`"
  >
    <span v-if="item.modified && item.lastPublishedAt">
      <AposLabel
        label="Pending Updates" class="apos-table__cell-field__label"
        tooltip="Published document with unpublished updates"
      />
    </span>
    <span v-if="item.submitted">
      <AposLabel
        label="Pending" class="apos-table__cell-field__label"
        tooltip="Awaiting approval from Admins & Editors"
      />
    </span>
    <span v-if="manuallyPublished && !item.lastPublishedAt">
      <AposLabel
        label="Draft" class="apos-table__cell-field__label"
        :modifiers="[ 'is-warning' ]"
        tooltip="Unpublished Draft"
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
  },
  computed: {
    manuallyPublished() {
      const module = apos.modules[this.item.type];
      return module.localized && !module.autopublish;
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
