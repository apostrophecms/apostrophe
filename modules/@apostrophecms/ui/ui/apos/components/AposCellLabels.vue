<template>
  <div
    class="apos-table__cell-field apos-table__cell-field--labels"
    :class="`apos-table__cell-field--${header.name}`"
  >
    <span v-if="manuallyPublished && draft.modified && draft.lastPublishedAt">
      <AposLabel
        label="apostrophe:pendingUpdates" class="apos-table__cell-field__label"
        tooltip="apostrophe:thereAreActiveChanges"
        :modifiers="[ 'apos-is-success', 'apos-is-filled' ]"
      />
    </span>
    <span v-else-if="draft.submitted">
      <AposLabel
        label="apostrophe:pending" class="apos-table__cell-field__label"
        tooltip="apostrophe:changesAwaitingApproval"
        :modifiers="[ 'apos-is-filled' ]"
      />
    </span>
    <span v-if="manuallyPublished && !draft.lastPublishedAt">
      <AposLabel
        label="apostrophe:draft" class="apos-table__cell-field__label"
        :modifiers="[ 'apos-is-warning', 'apos-is-filled' ]"
        tooltip="apostrophe:notYetPublished"
      />
    </span>
    <span v-if="draft.archived">
      <AposLabel
        label="apostrophe:archived" class="apos-table__cell-field__label"
        :modifiers="[ 'apos-is-filled', 'apos-is-danger' ]"
      />
    </span>
  </div>
</template>

<script>
import AposCellMixin from 'Modules/@apostrophecms/ui/mixins/AposCellMixin';

export default {
  name: 'AposCellLabels',
  mixins: [ AposCellMixin ],
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
