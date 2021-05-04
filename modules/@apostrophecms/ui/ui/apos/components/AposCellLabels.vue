<template>
  <div
    class="apos-table__cell-field apos-table__cell-field--labels"
    :class="`apos-table__cell-field--${header.name}`"
  >
    <span v-if="manuallyPublished && (item.modified || draft.modified) && !item.submitted && item.lastPublishedAt">
      <AposLabel
        label="Pending Updates" class="apos-table__cell-field__label"
        tooltip="There are active changes to this document."
        :modifiers="[ 'is-success', 'is-filled' ]"
      />
    </span>
    <span v-else-if="item.submitted">
      <AposLabel
        label="Pending" class="apos-table__cell-field__label"
        tooltip="Changes to this document are awaiting approval by an admin or editor."
        :modifiers="[ 'is-filled' ]"
      />
    </span>
    <span v-if="manuallyPublished && !item.lastPublishedAt">
      <AposLabel
        label="Draft" class="apos-table__cell-field__label"
        :modifiers="[ 'is-warning', 'is-filled' ]"
        tooltip="This document hasn't been published yet."
      />
    </span>
    <span v-if="item.archived">
      <AposLabel
        label="Archived" class="apos-table__cell-field__label"
        :modifiers="[ 'is-filled', 'is-danger' ]"
      />
    </span>
  </div>
</template>

<script>
export default {
  name: 'AposCellLabels',
  props: {
    item: {
      type: Object,
      required: true
    },
    draft: {
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
    display: flex;
    justify-content: flex-end;
    padding-right: 10px;
  }
  .apos-table__cell-field__label {
    margin-left: 5px;
  }
</style>
