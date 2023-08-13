<template>
  <AposModal
    :modal="modal"
    modal-title="apostrophe:managePages"
    @esc="confirmAndCancel"
    @no-modal="$emit('safe-close')"
    @inactive="modal.active = false"
    @show-modal="modal.showModal = true"
  >
    <template #secondaryControls>
      <AposButton
        v-if="relationshipField"
        type="default" label="apostrophe:cancel"
        @click="confirmAndCancel"
      />
      <AposButton
        v-else
        type="default" label="apostrophe:exit"
        @click="confirmAndCancel"
      />
    </template>
    <template #primaryControls>
      <AposUtilityOperations
        :module-options="moduleOptions"
        :has-relationship-field="!!relationshipField"
      />
      <AposContextMenu
        v-if="relationshipField"
        :menu="moreMenu"
        menu-placement="bottom-end"
        @item-clicked="moreMenuHandler"
        :button="moreMenuButton"
      />
      <AposButton
        v-else type="primary"
        label="apostrophe:newPage" @click="create()"
      />
      <AposButton
        v-if="relationshipField"
        type="primary"
        :label="saveRelationshipLabel"
        :disabled="!!relationshipErrors"
        @click="saveRelationship"
      />
    </template>
    <template v-if="relationshipField" #leftRail>
      <AposModalRail>
        <div class="apos-pages-manager__relationship__rail">
          <div class="apos-pages-manager__relationship__counts">
            <AposMinMaxCount
              :field="relationshipField"
              :value="checkedDocs"
            />
          </div>
          <AposSlatList
            class="apos-pages-manager__relationship__items"
            @input="setCheckedDocs"
            :value="checkedDocs"
          />
        </div>
      </AposModalRail>
    </template>
    <template #main>
      <AposModalBody>
        <template #bodyHeader v-if="!relationshipField">
          <AposModalToolbar>
            <template #rightControls>
              <AposContextMenu
                :menu="pageSetMenu"
                menu-placement="bottom-end"
                @item-clicked="pageSetMenuSelection = $event"
                :button="pageSetMenuButton"
              />
            </template>
          </AposModalToolbar>
        </template>
        <template #bodyMain>
          <AposTree
            :items="items"
            :headers="headers"
            :icons="icons"
            v-model="checked"
            :options="treeOptions"
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
  emits: [ 'archive', 'search', 'safe-close', 'modal-result' ]
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
