<template>
  <AposInputWrapper
    ref="root"
    :field="field"
    :error="effectiveError"
    :uid="uid"
    :items="next"
    :display-options="displayOptions"
    :modifiers="[...(isInlineTable ? ['full-width'] : [])]"
    :meta="arrayMeta"
  >
    <template #additional>
      <AposMinMaxCount
        :field="field"
        :model-value="next"
      />
    </template>
    <template
      v-if="isInlineStandard"
      #meta
    >
      <div class="apos-input-array-inline-all-controls">
        <AposButton
          class="
            apos-input-array-inline-all-control
            apos-input-array-inline-all-control--expand
          "
          label="apostrophe:expandAll"
          type="subtle"
          :modifiers="['inline', 'no-motion']"
          @click="toggleAll(true)"
        />
        <AposButton
          class="
            apos-input-array-inline-all-control
            apos-input-array-inline-all-control--collapse
          "
          label="apostrophe:collapseAll"
          type="subtle"
          :modifiers="['inline', 'no-motion']"
          @click="toggleAll(false)"
        />
      </div>
    </template>
    <template #body>
      <div
        v-if="(isInlineStandard || isInlineTable) && !items.length"
        class="apos-input-array-inline-empty"
      >
        <component
          :is="emptyWhenIcon"
          :size="50"
        />
        <label class="apos-input-array-inline-empty-label">
          {{ $t(emptyWhenLabel) }}
        </label>
      </div>

      <!-- INLINE TABLE -->
      <div v-if="isInlineTable">
        <table
          v-if="items.length"
          class="apos-input-array-inline-table"
        >
          <thead class="apos-input-array-inline-table-header">
            <tr>
              <th
                v-if="isDraggable"
                class="apos-input-array-inline-table-header-cell"
              />
              <th
                v-for="subfield in visibleSchema()"
                :key="subfield._id"
                class="apos-input-array-inline-table-header-cell"
                :class="getTableHeaderClass(
                  subfield,
                  'apos-input-array-inline-table-header-cell'
                )"
                :style="subfield.columnStyle || {}"
              >
                {{ $t(subfield.label) }}
              </th>
              <th class="apos-input-array-inline-table-header-cell" />
            </tr>
          </thead>
          <draggable
            :id="listId"
            item-key="_id"
            role="list"
            :class="{ 'apos-input-array-inline-array--is-dragging': isDragging }"
            :options="dragOptions"
            tag="tbody"
            :list="items"
            @update="moveUpdate"
            @start="startDragging"
            @end="stopDragging"
          >
            <template #item="{ element: item, index }">
              <AposSchema
                :key="item._id"
                v-model="item.schemaInput"
                :data-id="item._id"
                :tabindex="isDraggable ? '0' : '-1'"
                class="apos-input-array-inline-table-row"
                data-apos-input-array-inline-item
                :meta="arrayMeta[item._id]?.aposMeta"
                :class="{
                  'apos-input-array-inline-table-row--active': item.open,
                  'apos-input-array-inline-table-row--engaged': item.engaged
                }"
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
                @keydown.space="isDraggable
                  ? toggleEngage($event, { exact: true, prevent: true })
                  : {}"
                @keydown.enter="isDraggable
                  ? toggleEngage($event, { exact: true, prevent: true })
                  : {}"
                @keydown.arrow-up="isDraggable
                  ? moveEngaged($event, item._id, -1, { prevent: true })
                  : {}"
                @keydown.arrow-down="isDraggable
                  ? moveEngaged($event, item._id, 1, { prevent: true })
                  : {}"
              >
                <template #before>
                  <td
                    v-if="isDraggable"
                    class="
                      apos-input-array-inline-table-cell
                      apos-input-array-inline-table-cell--controls
                    "
                    :style="field.columnStyle"
                  >
                    <AposIndicator
                      icon="drag-icon"
                      class="
                        apos-input-array-inline-table-cell-drag-handle
                        apos-drag-handle
                      "
                      :decorative="false"
                      @keydown.prevent.space="toggleEngage($event, item._id)"
                      @keydown.prevent.enter="toggleEngage($event, item._id)"
                    />
                  </td>
                </template>
                <template #after>
                  <td
                    class="
                      apos-input-array-inline-table-cell
                      apos-input-array-inline-table-cell--controls
                      apos-input-array-inline-table-cell--controls--menu
                    "
                  >
                    <AposContextMenu
                      v-if="getInlineMenuItems(index).length > 1"
                      ref="menu"
                      data-apos-input-array-inline-item-menu
                      class=""
                      :button="{
                        label: 'apostrophe:moreOperations',
                        iconOnly: true,
                        icon: 'dots-vertical-icon',
                        type: 'subtle',
                        modifiers: ['small', 'no-motion'],
                      }"
                      :menu="getInlineMenuItems(index)"
                      menu-placement="bottom-end"
                      @keydown.space="$event.stopImmediatePropagation()"
                      @keydown.enter="$event.stopImmediatePropagation()"
                      @item-clicked="
                        inlineMenuHandler($event, { index, id: item._id })
                      "
                    />
                    <AposButton
                      v-else
                      data-apos-input-array-inline-item-remove
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
      </div>

      <!-- INLINE STANDARD-->
      <div v-else-if="field.inline">
        <draggable
          :id="listId"
          item-key="_id"
          class="apos-input-array-inline-standard"
          :class="{ 'apos-input-array-inline-array--is-dragging': isDragging }"
          role="list"
          :options="dragOptions"
          tag="div"
          :list="items"
          @update="moveUpdate"
          @start="startDragging"
          @end="stopDragging"
        >
          <template #item="{ element: item, index }">
            <div
              :key="item._id"
              class="apos-input-array-inline-item"
              data-apos-input-array-inline-item
              :data-id="item._id"
              tabindex="0"
              :aria-pressed="item.engaged"
              role="listitem"
              :class="{
                'apos-input-array-inline-item--open': item.open,
                'apos-input-array-inline-item--engaged': item.engaged,
                'apos-input-array-inline-item--drag-disabled': !isDraggable,
              }"
              @keydown.prevent.exact.space="isDraggable
                ? toggleOpenInlineItem($event)
                : {}"
              @keydown.prevent.shift.space="isDraggable
                ? toggleEngage($event, item._id)
                : {}"
              @keydown.prevent.enter="isDraggable
                ? toggleEngage($event, item._id)
                : {}"
              @keydown.prevent.arrow-up="isDraggable
                ? moveEngaged($event, item._id, -1)
                : {}"
              @keydown.prevent.arrow-down="isDraggable
                ? moveEngaged($event, item._id, 1)
                : {}"
            >
              <div
                class="apos-input-array-inline-header"
                @dblclick="toggleOpenInlineItem($event)"
              >
                <div
                  class="
                    apos-input-array-inline-header-ui
                    apos-input-array-inline-header-ui--left
                  "
                >
                  <AposIndicator
                    v-if="isDraggable"
                    icon="drag-icon"
                    class="apos-input-array-inline-header-ui-element"
                  />
                  <div class="apos-input-array-inline-label">
                    {{ getLabel(item._id, index) }}
                  </div>
                </div>
                <div
                  class="
                    apos-input-array-inline-header-ui
                    apos-input-array-inline-header-ui--right
                  "
                >
                  <AposButton
                    class="
                      apos-input-array-inline-header-ui-element
                      apos-input-array-inline-collapse
                    "
                    :icon-size="16"
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
                    @click="toggleOpenInlineItem($event)"
                    @keydown.space="$event.stopImmediatePropagation()"
                    @keydown.enter="$event.stopImmediatePropagation()"
                  />
                  <AposContextMenu
                    ref="menu"
                    class="apos-input-array-inline-header-ui-element"
                    data-apos-input-array-inline-item-menu
                    :button="{
                      label: 'apostrophe:moreOperations',
                      iconOnly: true,
                      icon: 'dots-vertical-icon',
                      type: 'subtle',
                      modifiers: ['small', 'no-motion'],
                    }"
                    :menu="getInlineMenuItems(index)"
                    menu-placement="bottom-end"
                    @keydown.space="$event.stopImmediatePropagation()"
                    @keydown.enter="$event.stopImmediatePropagation()"
                    @item-clicked="
                      inlineMenuHandler($event, { index, id: item._id })
                    "
                  />
                </div>
              </div>
              <transition
                name="collapse"
                :duration="400"
              >
                <div
                  v-show="item.open"
                  class="apos-input-array-inline-body"
                >
                  <AposSchema
                    :key="item._id"
                    v-model="item.schemaInput"
                    :data-apos-id="item._id"
                    class="apos-input-array-inline-schema"
                    :meta="arrayMeta[item._id]?.aposMeta"
                    :class="
                      item.open
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
                    @keydown.space="$event.stopImmediatePropagation()"
                    @keydown.enter="$event.stopImmediatePropagation()"
                  />
                </div>
              </transition>
            </div>
          </template>
        </draggable>
      </div>

      <div
        v-else
        class="apos-input-array"
      >
        <label class="apos-input-wrapper">
          <AposButton
            :label="editLabel"
            :disabled="field.readOnly"
            :tooltip="tooltip"
            @click="edit"
          />
        </label>
      </div>

      <!-- INLINE ADD BUTTON -->
      <AposButton
        v-if="isInlineStandard || isInlineTable"
        type="primary"
        class="apos-input-array-inline-add-button"
        :label="itemLabel"
        icon="plus-icon"
        :disabled="isAddDisabled"
        :modifiers="['block']"
        @click="add"
      />
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

<style lang="scss" src="../scss/AposInputArray.scss" scoped></style>
<style lang="scss">
.apos-is-dragging td {
  flex: 1;
  background-color: var(--a-background-primary);
}
</style>
