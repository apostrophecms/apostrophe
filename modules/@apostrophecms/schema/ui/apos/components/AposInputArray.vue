<template>
  <AposInputWrapper
    :field="field"
    :error="effectiveError"
    :uid="uid"
    :items="next"
    :display-options="displayOptions"
    :modifiers="[
      ...field.style === 'table' ? ['full-width'] : []
    ]"
    :meta="arrayMeta"
  >
    <template #additional>
      <AposMinMaxCount
        :field="field"
        :model-value="next"
      />
    </template>
    <template #body>
      <div v-if="field.inline">
        <div
          v-if="!items.length && field.whenEmpty"
          class="apos-input-array-inline-empty"
        >
          <component
            :is="field.whenEmpty.icon"
            v-if="field.whenEmpty.icon"
            :size="50"
          />
          <label
            v-if="field.whenEmpty.label"
            class="apos-input-array-inline-empty-label"
          >
            {{ $t(field.whenEmpty.label) }}
          </label>
        </div>
        <component
          :is="field.style === 'table' ? 'table' : 'div'"
          v-if="items.length"
          :class="field.style === 'table' ? 'apos-input-array-inline-table' : 'apos-input-array-inline-standard'"
        >
          <thead
            v-if="field.style === 'table'"
          >
            <th class="apos-table-cell--hidden" />
            <th
              v-for="subfield in visibleSchema()"
              :key="subfield._id"
              :style="subfield.columnStyle || {}"
            >
              {{ $t(subfield.label) }}
            </th>
            <th />
          </thead>
          <draggable
            :id="listId"
            item-key="_id"
            class="apos-input-array-inline"
            role="list"
            :options="dragOptions"
            :tag="field.style === 'table' ? 'tbody' : 'div'"
            :list="items"
            @update="moveUpdate"
          >
            <template #item="{element: item, index}">
              <AposSchema
                :key="item._id"
                v-model="item.schemaInput"
                class="apos-input-array-inline-item"
                :meta="arrayMeta[item._id]?.aposMeta"
                :class="item.open && !alwaysExpand ? 'apos-input-array-inline-item--active' : null"
                :schema="schema"
                :trigger-validation="triggerValidation"
                :generation="generation"
                :modifiers="['small', 'inverted']"
                :doc-id="docId"
                :following-values="getFollowingValues(item)"
                :conditional-fields="itemsConditionalFields[item._id]"
                :field-style="field.style"
                @update:model-value="setItemsConditionalFields(item._id)"
                @validate="emitValidate()"
              >
                <template #before>
                  <component
                    :is="field.style === 'table' ? 'td' : 'div'"
                    class="apos-input-array-inline-item-controls"
                    :style="(field.style === 'table' && field.columnStyle) || {}"
                  >
                    <AposIndicator
                      v-if="field.draggable"
                      icon="drag-icon"
                      class="apos-drag-handle"
                    />
                    <AposButton
                      v-if="field.style !== 'table' && item.open && !alwaysExpand"
                      class="apos-input-array-inline-collapse"
                      :icon-size="15"
                      label="apostrophe:close"
                      icon="unfold-less-horizontal-icon"
                      type="subtle"
                      :modifiers="['inline', 'no-motion']"
                      :icon-only="true"
                      @click="closeInlineItem(item._id)"
                    />
                  </component>
                  <h3
                    v-if="field.style !== 'table' && !item.open && !alwaysExpand"
                    class="apos-input-array-inline-label"
                    @click="openInlineItem(item._id)"
                  >
                    {{ getLabel(item._id, index) }}
                  </h3>
                </template>
                <template #after>
                  <component
                    :is="field.style === 'table' ? 'td' : 'div'"
                    class="apos-input-array-inline-item-controls--remove"
                  >
                    <AposButton
                      label="apostrophe:removeItem"
                      icon="close-icon"
                      type="subtle"
                      :modifiers="['inline','no-motion']"
                      :icon-only="true"
                      @click="remove(item._id)"
                    />
                  </component>
                </template>
              </AposSchema>
            </template>
          </draggable>
        </component>
        <AposButton
          type="primary"
          :label="itemLabel"
          icon="plus-icon"
          :disabled="disableAdd()"
          :modifiers="['block']"
          @click="add"
        />
      </div>
      <div v-else class="apos-input-array">
        <label class="apos-input-wrapper">
          <AposButton
            :label="editLabel"
            :disabled="field.readOnly"
            :tooltip="tooltip"
            @click="edit"
          />
        </label>
      </div>
    </template>
  </AposInputWrapper>
</template>

<script>
import AposInputArrayLogic from '../logic/AposInputArray';
import { Sortable } from 'sortablejs-vue3';

export default {
  name: 'AposInputArray',
  components: {
    draggable: Sortable
  },
  mixins: [ AposInputArrayLogic ]
};
</script>

<style lang="scss" src="../scss/AposInputArray.scss" scoped>
</style>
