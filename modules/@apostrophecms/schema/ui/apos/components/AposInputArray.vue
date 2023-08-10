<template>
  <AposInputWrapper
    :field="field" :error="effectiveError"
    :uid="uid" :items="next"
    :display-options="displayOptions"
  >
    <template #additional>
      <AposMinMaxCount
        :field="field"
        :value="next"
      />
    </template>
    <template #body>
      <div v-if="field.inline">
        <div
          v-if="!items.length && field.whenEmpty"
          class="apos-input-array-inline-empty"
        >
          <component
            v-if="field.whenEmpty.icon"
            :is="field.whenEmpty.icon"
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
          v-if="items.length"
          :is="field.style === 'table' ? 'table' : 'div'"
          :class="field.style === 'table' ? 'apos-input-array-inline-table' : 'apos-input-array-inline-standard'"
        >
          <thead
            v-if="field.style === 'table'"
          >
            <th class="apos-table-cell--hidden" />
            <th
              v-for="subfield in visibleSchema()"
              :key="subfield._id"
            >
              {{ $t(subfield.label) }}
            </th>
            <th />
          </thead>
          <draggable
            class="apos-input-array-inline"
            :tag="field.style === 'table' ? 'tbody' : 'div'"
            role="list"
            :list="items"
            v-bind="dragOptions"
            :id="listId"
          >
            <AposSchema
              v-for="(item, index) in items"
              :key="item._id"
              :schema="schema"
              class="apos-input-array-inline-item"
              :class="item.open && !alwaysExpand ? 'apos-input-array-inline-item--active' : null"
              v-model="item.schemaInput"
              :trigger-validation="triggerValidation"
              :generation="generation"
              :modifiers="['small', 'inverted']"
              :doc-id="docId"
              :following-values="getFollowingValues(item)"
              :conditional-fields="conditionalFields(item.schemaInput?.data || {})"
              :field-style="field.style"
            >
              <template #before>
                <component
                  :is="field.style === 'table' ? 'td' : 'div'"
                  class="apos-input-array-inline-item-controls"
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
                  class="apos-input-array-inline-label"
                  v-if="field.style !== 'table' && !item.open && !alwaysExpand"
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
                    icon="trash-can-outline-icon"
                    type="subtle"
                    :modifiers="['inline', 'danger', 'no-motion']"
                    :icon-only="true"
                    @click="remove(item._id)"
                  />
                </component>
              </template>
            </AposSchema>
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
            @click="edit"
            :disabled="field.readOnly"
            :tooltip="tooltip"
          />
        </label>
      </div>
    </template>
  </AposInputWrapper>
</template>

<script>
import AposInputArrayLogic from '../logic/AposInputArray';
export default {
  name: 'AposInputArray',
  mixins: [ AposInputArrayLogic ]
};
</script>
<style lang="scss" scoped>
  ::v-deep .apos-field--array.apos-field--error-duplicate {
    .apos-input {
      border-color: var(--a-base-8);
    }
    .apos-input:focus {
      box-shadow: 0 0 3px var(--a-base-8);
    }
    .apos-input-icon {
      color: var(--a-base-2);
    }
    .apos-input--error {
      border-color: var(--a-danger);
    }
  }
  ::v-deep .apos-input-relationship {
    .apos-button__wrapper {
      display: none;
    }
    .apos-input {
      width: auto;
    }
    .apos-slat__main {
      min-width: 130px;
    }
  }
  .apos-is-dragging {
    opacity: 0.5;
    background: var(--a-base-4);
  }
  .apos-input-array-inline-empty {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    margin-bottom: $spacing-base;
    padding: $spacing-triple 0;
    border: 1px solid var(--a-base-9);
    color: var(--a-base-8);
  }
  .apos-input-array-inline-empty-label {
    @include type-label;
    color: var(--a-base-3);
  }

  .apos-input-array-inline-table {
    @include type-label;
    position: relative;
    left: -35px;
    min-width: calc(100% + 35px);
    width: max-content;
    margin: 0 0 $spacing-base;
    border-collapse: collapse;

    th {
      padding-left: $spacing-base;
      padding-right: $spacing-base;
      height: 40px;
      border: 1px solid var(--a-base-9);
      text-align: left;
      background-color: var(--a-base-10);
    }
    .apos-table-cell--hidden {
      padding-left: 5px;
      border: none;
      cursor: pointer;
      background-color: transparent;
    }

    td, ::v-deep td {
      padding: $spacing-base;
      border: 1px solid var(--a-base-9);
      vertical-align: middle;
      text-align: center;
      transition: background-color 0.3s ease;
      background-color: var(--a-background-primary);
    }
    td.apos-input-array-inline-item-controls {
      width: 15px;
      min-width: 15px;
      border: none;
      background-color: transparent;
    }
    tr.apos-is-dragging, ::v-deep tr.apos-is-dragging {
      td, &:hover td {
        background: var(--a-base-4);
      }
    }
    tr:hover, ::v-deep tr:hover {
      td {
        background-color: var(--a-base-10);
      }
      td.apos-input-array-inline-item-controls {
        background-color: transparent;
      }
    }

    ::v-deep {
      .apos-field__info {
        padding-top: 0;
      }
      .apos-field__label {
        display: none;
      }
      .apos-input-wrapper {
        padding: 0 4px;
      }
      .apos-input--select {
        min-width: 130px;
      }
      .apos-input--relationship {
        width: 100%;
        min-width: 150px;
      }
      .apos-schema .apos-field.apos-field--small,
      .apos-schema .apos-field.apos-field--micro,
      .apos-schema .apos-field.apos-field--margin-micro {
        margin-bottom: 0;
      }
      .apos-search {
        z-index: calc(#{$z-index-widget-focused-controls} + 1);
        position: absolute;
        top: 35px;
        width: 100%;
        min-width: 350px;
      }
      .apos-slat-list .apos-slat,
      .apos-input-relationship__items {
        margin-top: 0;
        margin-bottom: 0;
      }
      .apos-input-relationship__input-wrapper :disabled {
        display: none;
      }
      .apos-field__error {
        position: absolute;
        bottom: 13px;
        left: $spacing-base;
      }
      .apos-field--relationship .apos-field__error {
        z-index: calc(#{$z-index-widget-focused-controls} + 1);
      }
    }
  }

  .apos-input-array-inline-standard {
    .apos-input-array-inline-collapse {
      position: absolute;
      top: $spacing-quadruple;
      left: $spacing-base;
    }

    ::v-deep .apos-schema {
      position: relative;
      display: grid;
      grid-template-columns: 35px auto 35px;
      gap: 5px;
      width: 100%;
      padding-bottom: $spacing-base;
      border-bottom: 1px solid var(--a-base-9);
      transition: background-color 0.3s ease;
      &:hover {
        background-color: var(--a-base-10);
      }
      .apos-field.apos-field--small,
      .apos-field.apos-field--micro,
      .apos-field.apos-field--margin-micro {
        margin-bottom: 0;
      }

      & > div {
        grid-column: 2;
        padding-top: $spacing-base;
        padding-bottom: $spacing-base;
      }
      &.apos-input-array-inline-item--active {
        background-color: var(--a-base-10);
        border-bottom: 1px solid var(--a-base-6);
      }
      &.apos-input-array-inline-item--active > div {
        display: block;
      }
      .apos-input-array-inline-label,
      .apos-input-array-inline-item-controls,
      .apos-input-array-inline-item-controls--remove {
        display: block;
      }

      .apos-input-array-inline-label {
        transition: background-color 0.3s ease;
        @include type-label;
        margin: 0;
        padding-top: $spacing-base;
        padding-bottom: $spacing-base;
        text-align: left;
        grid-column: 2;
      }
      .apos-input-array-inline-label:hover {
        cursor: pointer;
      }

      .apos-input-array-inline-item-controls {
        padding: $spacing-base;
        grid-column: 1;
        grid-row: 1;
      }
      .apos-input-array-inline-item-controls--remove {
        grid-column: 3;
        grid-row: 1;
      }
    }
  }
</style>
