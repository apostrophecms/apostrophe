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
import AposInputMixin from 'Modules/@apostrophecms/schema/mixins/AposInputMixin.js';
import AposInputFollowingMixin from 'Modules/@apostrophecms/schema/mixins/AposInputFollowingMixin.js';
import AposInputConditionalFieldsMixin from 'Modules/@apostrophecms/schema/mixins/AposInputConditionalFieldsMixin.js';

import cuid from 'cuid';
import { klona } from 'klona';
import { get } from 'lodash';
import draggable from 'vuedraggable';

export default {
  name: 'AposInputArray',
  components: { draggable },
  mixins: [
    AposInputMixin,
    AposInputFollowingMixin,
    AposInputConditionalFieldsMixin
  ],
  props: {
    generation: {
      type: Number,
      required: false,
      default: null
    }
  },
  data() {
    const next = this.getNext();
    const data = {
      next,
      items: modelItems(next, this.field)
    };
    return data;
  },
  computed: {
    // required by the conditional fields mixin
    schema() {
      return this.field.schema;
    },
    alwaysExpand() {
      return alwaysExpand(this.field);
    },
    listId() {
      return `sortableList-${cuid()}`;
    },
    dragOptions() {
      return {
        disabled: !this.field.draggable || this.field.readOnly || this.next.length <= 1,
        ghostClass: 'apos-is-dragging',
        handle: '.apos-drag-handle'
      };
    },
    itemLabel() {
      return this.field.itemLabel
        ? {
          key: 'apostrophe:addType',
          type: this.$t(this.field.itemLabel)
        }
        : 'apostrophe:addItem';
    },
    editLabel() {
      return {
        key: 'apostrophe:editType',
        type: this.$t(this.field.label)
      };
    },
    effectiveError() {
      const error = this.error || this.serverError;
      // Server-side errors behave differently
      const name = error?.name || error;
      if (name === 'invalid') {
        // Always due to a subproperty which will display its own error,
        // don't confuse the user
        return false;
      }
      return error;
    }
  },
  watch: {
    generation() {
      this.next = this.getNext();
      this.items = modelItems(this.next, this.field);
    },
    items: {
      deep: true,
      handler() {
        const erroneous = this.items.filter(item => item.schemaInput.hasErrors);
        if (erroneous.length) {
          erroneous.forEach(item => {
            if (!item.open) {
              // Make errors visible
              item.open = true;
            }
          });
        } else {
          const next = this.items.map(item => ({
            ...item.schemaInput.data,
            _id: item._id,
            metaType: 'arrayItem',
            scopedArrayName: this.field.scopedArrayName
          }));
          this.next = next;
        }
        // Our validate method was called first before that of
        // the subfields, so remedy that by calling again on any
        // change to the subfield state during validation
        if (this.triggerValidation) {
          this.validateAndEmit();
        }
      }
    }
  },
  async created() {
    if (this.field.inline) {
      await this.evaluateExternalConditions();
    }
  },
  methods: {
    validate(value) {
      if (this.items.find(item => item.schemaInput.hasErrors)) {
        return 'invalid';
      }
      if (this.field.required && !value.length) {
        return 'required';
      }
      if (this.field.min && value.length < this.field.min) {
        return 'min';
      }
      if (this.field.max && value.length > this.field.max) {
        return 'max';
      }
      if (value.length && this.field.fields && this.field.fields.add) {
        const [ uniqueFieldName, uniqueFieldSchema ] = Object.entries(this.field.fields.add).find(([ , subfield ]) => subfield.unique) || [];
        if (uniqueFieldName) {
          const duplicates = this.next
            .map(item =>
              Array.isArray(item[uniqueFieldName])
                ? item[uniqueFieldName].map(i => i._id).sort().join('|')
                : item[uniqueFieldName])
            .filter((item, index, array) => array.indexOf(item) !== index);

          if (duplicates.length) {
            duplicates.forEach(duplicate => {
              this.items.forEach(item => {
                uniqueFieldSchema.type === 'relationship'
                  ? item.schemaInput.data[uniqueFieldName] && item.schemaInput.data[uniqueFieldName].forEach(datum => {
                    item.schemaInput.fieldState[uniqueFieldName].duplicate = duplicate.split('|').find(i => i === datum._id);
                  })
                  : item.schemaInput.fieldState[uniqueFieldName].duplicate = item.schemaInput.data[uniqueFieldName] === duplicate;
              });
            });

            return {
              name: 'duplicate',
              message: `${this.$t('apostrophe:duplicateError')} ${this.$t(uniqueFieldSchema.label) || uniqueFieldName}`
            };
          }
        }
      }
      return false;
    },
    async edit() {
      const result = await apos.modal.execute('AposArrayEditor', {
        field: this.field,
        items: this.next,
        serverError: this.serverError,
        docId: this.docId,
        parentFollowingValues: this.followingValues
      });
      if (result) {
        this.next = result;
      }
    },
    getNext() {
      // Next should consistently be an array.
      return (this.value && Array.isArray(this.value.data))
        ? this.value.data : (this.field.def || []);
    },
    disableAdd() {
      return this.field.max && (this.items.length >= this.field.max);
    },
    remove(_id) {
      this.items = this.items.filter(item => item._id !== _id);
    },
    add() {
      const _id = cuid();
      this.items.push({
        _id,
        schemaInput: {
          data: this.newInstance()
        },
        open: alwaysExpand(this.field)
      });
      this.openInlineItem(_id);
    },
    newInstance() {
      const instance = {};
      for (const field of this.field.schema) {
        if (field.def !== undefined) {
          instance[field.name] = klona(field.def);
        }
      }
      return instance;
    },
    getLabel(id, index) {
      const titleField = this.field.titleField || null;
      const item = this.items.find(item => item._id === id);
      return get(item.schemaInput.data, titleField) || `Item ${index + 1}`;
    },
    openInlineItem(id) {
      this.items.forEach(item => {
        item.open = (item._id === id) || this.alwaysExpand;
      });
    },
    closeInlineItem(id) {
      this.items.forEach(item => {
        item.open = this.alwaysExpand;
      });
    },
    getFollowingValues(item) {
      return this.computeFollowingValues(item.schemaInput.data);
    },
    // Retrieve table heading fields from the schema, based on the currently
    // opened item. Available only when the field style is `table`.
    visibleSchema() {
      if (this.field.style !== 'table') {
        return this.schema;
      }
      const currentItem = this.items.find(item => item.open) || this.items[this.items.length - 1];
      const conditions = this.conditionalFields(currentItem?.schemaInput?.data || {});
      return this.schema.filter(
        field => conditions[field.name] !== false
      );
    }
  }
};

function modelItems(items, field) {
  return items.map(item => {
    const open = alwaysExpand(field);
    return {
      _id: item._id || cuid(),
      schemaInput: {
        data: item
      },
      open
    };
  });
}

function alwaysExpand(field) {
  if (!field.inline) {
    return false;
  }
  if (field.inline.alwaysExpand === undefined) {
    return field.schema.length < 3;
  }
  return field.inline.alwaysExpand;
}
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
