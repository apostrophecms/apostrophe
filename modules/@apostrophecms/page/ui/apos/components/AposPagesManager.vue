<template>
  <AposModal
    :modal="modal"
    :modal-data="modalData"
    modal-title="apostrophe:managePages"
    @esc="confirmAndCancel"
    @inactive="modal.active = false"
    @show-modal="modal.showModal = true"
  >
    <template #secondaryControls>
      <AposButton
        v-if="relationshipField"
        type="default"
        label="apostrophe:cancel"
        @click="confirmAndCancel"
      />
      <AposButton
        v-else
        type="default"
        label="apostrophe:exit"
        @click="confirmAndCancel"
      />
    </template>
    <template #primaryControls>
      <AposUtilityOperations
        :module-options="moduleOptions"
        :has-relationship-field="!!relationshipField"
      />
      <AposButton
        v-if="relationshipField"
        type="primary"
        :label="saveRelationshipLabel"
        :disabled="!!relationshipErrors"
        :attrs="{'data-apos-focus-priority': true}"
        @click="saveRelationship"
      />
      <AposButton
        v-else-if="canCreate"
        type="primary"
        label="apostrophe:newPage"
        :attrs="{'data-apos-focus-priority': true}"
        @click="create()"
      />
    </template>
    <template v-if="relationshipField" #leftRail>
      <AposModalRail>
        <div class="apos-pages-manager__relationship__rail">
          <div class="apos-pages-manager__relationship__counts">
            <AposMinMaxCount
              :field="relationshipField"
              :model-value="checkedDocs"
            />
          </div>
          <AposSlatList
            class="apos-pages-manager__relationship__items"
            :model-value="checkedDocs"
            :relationship-schema="relationshipField?.schema"
            @update:model-value="setCheckedDocs"
            @item-clicked="editRelationship"
          />
        </div>
      </AposModalRail>
    </template>
    <template #main>
      <AposModalBody>
        <template v-if="!relationshipField" #bodyHeader>
          <AposDocsManagerToolbar
            :selected-state="selectAllState"
            :total-pages="totalPages"
            :current-page="currentPage"
            :filter-choices="filterChoices"
            :filter-values="filterValues"
            :filters="moduleOptions.filters"
            :labels="moduleLabels"
            :displayed-items="items.length"
            :is-relationship="!!relationshipField"
            :checked="checked"
            :checked-types="checkedTypes"
            :checked-count="checked.length"
            :batch-operations="moduleOptions.batchOperations"
            :module-name="moduleName"
            :options="{
              disableUnchecked: maxReached(),
              noPager: true,
              noSearch: true
            }"
            @select-click="selectAll"
            @search="onSearch"
            @filter="filter"
            @batch="handleBatchAction"
          />
          <AposDocsManagerSelectBox
            :selected-state="selectAllState"
            :module-labels="moduleLabels"
            :filter-values="filterValues"
            :checked-ids="checked"
            :all-pieces-selection="allPiecesSelection"
            :displayed-items="items.length"
            @select-all="selectAllPieces"
            @set-all-pieces-selection="setAllPiecesSelection"
          />
        </template>
        <template #bodyMain>
          <AposTree
            v-model:checked="checked"
            :items="pages"
            :headers="headers"
            :icons="icons"
            :options="treeOptions"
            :module-options="moduleOptions"
            @update="update"
          />
        </template>
      </AposModalBody>
    </template>
  </AposModal>
</template>

<script>
import AposPagesManagerLogic from 'Modules/@apostrophecms/page/logic/AposPagesManager';

export default {
  name: 'AposPagesManager',
  mixins: [ AposPagesManagerLogic ],
  // Keep it for linting
  emits: [ 'archive', 'search', 'modal-result' ]
};
</script>

<style lang="scss" scoped>
  .apos-pages-manager__relationship__rail {
    padding: 20px;
  }

  .apos-pages-manager__relationship__counts {
    margin-bottom: 20px;
  }
</style>
