<template>
  <AposInputWrapper
    :field="field"
    :error="effectiveError"
    :uid="uid"
    :items="next"
    :display-options="displayOptions"
    :modifiers="[...(field.style === 'table' ? ['full-width'] : [])]"
    :meta="arrayMeta"
  >
    <template #additional>
      <AposMinMaxCount :field="field" :model-value="next" />
    </template>
    <template v-if="field.inline && field.style !== 'table'" #meta>
      <div class="apos-input-array-inline-all-controls">
        <AposButton
          class="apos-input-array-inline-all-control apos-input-array-inline-all-control--expand"
          label="apostrophe:expandAll"
          type="subtle"
          :modifiers="['inline', 'no-motion']"
          @click="toggleAll(true)"
        />
        <AposButton
          class="apos-input-array-inline-all-control apos-input-array-inline-all-control--collapse"
          label="apostrophe:collapseAll"
          type="subtle"
          :modifiers="['inline', 'no-motion']"
          @click="toggleAll(false)"
        />
      </div>
    </template>
    <template #body>
      <!-- INLINE TABLE -->
      <div v-if="field.inline && field.style === 'table'">
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
        <table v-if="items.length" class="apos-input-array-inline-table">
          <thead>
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
            tag="tbody"
            :list="items"
            @update="moveUpdate"
          >
            <template #item="{ element: item, index }">
              <AposSchema
                :key="item._id"
                v-model="item.schemaInput"
                class="apos-input-array-inline-item"
                :meta="arrayMeta[item._id]?.aposMeta"
                :class="
                  item.open && !alwaysExpand
                    ? 'apos-input-array-inline-item--active'
                    : null
                "
                :schema="schema"
                :trigger-validation="triggerValidation"
                :generation="generation"
                :modifiers="['small', 'inverted']"
                :doc-id="docId"
                :following-values="getFollowingValues(item)"
                :conditional-fields="itemsConditionalFields[item._id]"
                field-style="table"
                @update:model-value="setItemsConditionalFields(item._id)"
                @validate="emitValidate()"
              >
                <template #before>
                  <td
                    class="apos-input-array-inline-item-controls"
                    :style="field.columnStyle"
                  >
                    <AposIndicator
                      v-if="field.draggable"
                      icon="drag-icon"
                      class="apos-drag-handle"
                    />
                    <!-- <AposButton
                      v-if="item.open && !alwaysExpand"
                      class="apos-input-array-inline-collapse"
                      :icon-size="15"
                      label="apostrophe:close"
                      icon="unfold-less-horizontal-icon"
                      type="subtle"
                      :modifiers="['inline', 'no-motion']"
                      :icon-only="true"
                      @click="closeInlineItem(item._id)"
                    /> -->
                  </td>
                </template>
                <template #after>
                  <td class="apos-input-array-inline-item-controls--remove">
                    <AposButton
                      label="apostrophe:removeItem"
                      icon="close-icon"
                      type="subtle"
                      :modifiers="['inline', 'no-motion']"
                      :icon-only="true"
                      @click="remove(item._id)"
                    />
                  </td>
                </template>
              </AposSchema>
            </template>
          </draggable>
        </table>
        <AposButton
          type="primary"
          :label="itemLabel"
          icon="plus-icon"
          :disabled="disableAdd()"
          :modifiers="['block']"
          @click="add"
        />
      </div>

      <!-- INLINE STANDARD-->
      <div v-else-if="field.inline">
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
        <draggable
          v-if="items.length"
          :id="listId"
          item-key="_id"
          class="apos-input-array-inline-standard"
          :class="{ 'apos-input-array-inline-standard--is-dragging': isDragging }"
          role="list"
          :options="dragOptions"
          tag="div"
          :list="items"
          @update="moveUpdate"
          @start="startDragging"
          @end="stopDragging"
        >
          <template #item="{ element: item, index }">
            <transition-group type="transition" name="apos-flip-list">
              <div
                :key="item._id"
                class="apos-input-array-inline-item"
                :class="{ 'apos-input-array-inline-item--open': item.open }"
              >
                <div
                  class="apos-input-array-inline-header"
                  @dblclick="toggleOpenInlineItem(item)"
                >
                  <div
                    class="apos-input-array-inline-header-ui apos-input-array-inline-header-ui--left"
                  >
                    <AposIndicator
                      icon="drag-icon"
                      class="apos-input-array-inline-header-ui-element"
                    />
                    <div class="apos-input-array-inline-label">
                      {{ getLabel(item._id, index) }}
                    </div>
                  </div>
                  <div
                    class="apos-input-array-inline-header-ui apos-input-array-inline-header-ui--right"
                  >
                    <AposButton
                      class="apos-input-array-inline-header-ui-element apos-input-array-inline-collapse"
                      :icon-size="15"
                      label="apostrophe:close"
                      :tooltip="item.open ? 'Collapse item' : 'Expand item'"
                      :icon="
                        item.open
                          ? 'arrow-collapse-vertical-icon'
                          : 'arrow-expand-vertical-icon'
                      "
                      type="subtle"
                      :modifiers="['inline', 'no-motion']"
                      :icon-only="true"
                      @click="toggleOpenInlineItem(item)"
                    />
                    <AposContextMenu
                      ref="menu"
                      class="apos-input-array-inline-header-ui-element"
                      :button="{
                        label: 'apostrophe:moreOperations',
                        iconOnly: true,
                        icon: 'dots-vertical-icon',
                        type: 'subtle',
                        modifiers: ['small', 'no-motion'],
                      }"
                      :menu="getInlineMenuItems(index)"
                      menu-placement="bottom-end"
                      @item-clicked="
                        inlineMenuHandler($event, { index, id: item._id })
                      "
                    />
                  </div>
                </div>
                <transition name="collapse">
                  <div v-show="item.open" class="apos-input-array-inline-body">
                    <AposSchema
                      :key="item._id"
                      v-model="item.schemaInput"
                      :data-apos-id="item._id"
                      class="apos-input-array-inline-schema"
                      :meta="arrayMeta[item._id]?.aposMeta"
                      :class="
                        item.open && !alwaysExpand
                          ? 'apos-input-array-inline-item--active'
                          : null
                      "
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
                      <!-- <template #after> -->
                      <!-- <div class="apos-input-array-inline-item-controls--remove">
                    <AposButton
                      label="apostrophe:removeItem"
                      icon="close-icon"
                      type="subtle"
                      :modifiers="['inline', 'no-motion']"
                      :icon-only="true"
                      @click="remove(item._id)"
                    />
                  </div> -->
                      <!-- </template> -->
                    </AposSchema>
                  </div>
                </transition>
              </div>
          </transition-group>
            <!-- <div class="apos-input-array-inline-item-controls">
                  <AposIndicator
                    v-if="field.draggable"
                    icon="drag-icon"
                    class="apos-drag-handle"
                  />

                </div>
                <h3
                  v-if="!item.open && !alwaysExpand"
                  class="apos-input-array-inline-label"
                  @click="openInlineItem(item._id)"
                >
                  {{ getLabel(item._id, index) }}
                </h3> -->
          </template>
        </draggable>
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
import AposInputArrayLogic from "../logic/AposInputArray";
import { Sortable } from "sortablejs-vue3";

export default {
  name: "AposInputArray",
  components: {
    draggable: Sortable,
  },
  mixins: [AposInputArrayLogic],
};
</script>

<style lang="scss" src="../scss/AposInputArray.scss" scoped></style>
