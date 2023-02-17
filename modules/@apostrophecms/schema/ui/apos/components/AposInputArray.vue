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
            size="50"
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
          :is="field.styles === 'table' ? 'table' : 'div'"
          :class="field.styles === 'table' ? 'apos-input-array-inline-table' : 'apos-input-array-inline'"
        >
          <thead
            v-if="field.styles === 'table'"
          >
            <th class="apos-table-cell--hidden" />
            <th
              v-for="schema in field.schema"
              :key="schema._id"
            >
              {{ $t(schema.label) }}
            </th>
            <th class="apos-table-cell--hidden" />
          </thead>
          <draggable
            class="apos-input-array-inline-item"
            :tag="field.styles === 'table' ? 'tbody' : 'div'"
            role="list"
            :list="items"
            v-bind="dragOptions"
            :id="listId"
          >
            <component
              :is="field.styles === 'table' ? 'transition' : 'div'"
              name="collapse"
              v-for="(item, index) in items"
              :key="item._id"
            >
              <AposSchema
                :schema="field.schema"
                :class="item.open && !alwaysExpand ? 'apos-input-array-inline-item--active' : null"
                v-model="item.schemaInput"
                :trigger-validation="triggerValidation"
                :utility-rail="false"
                :generation="generation"
                :modifiers="['small', 'inverted']"
                :doc-id="docId"
                :styles="field.styles"
              >
                <template #before>
                  <component
                    :is="field.styles === 'table' ? 'td' : 'div'"
                    class="apos-input-array-inline-item-controls"
                  >
                    <AposIndicator
                      v-if="field.draggable"
                      icon="drag-icon"
                      class="apos-drag-handle"
                    />
                    <AposButton
                      v-if="item.open && !alwaysExpand"
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
                    v-if="field.styles !== 'table' && !item.open && !alwaysExpand"
                    @click="openInlineItem(item._id)"
                  >
                    {{ getLabel(item._id, index) }}
                  </h3>
                </template>
                <template #after>
                  <component
                    :is="field.styles === 'table' ? 'td' : 'div'"
                    class="apos-input-array-inline-item-controls apos-input-array-inline-item-controls--remove"
                  >
                    <AposButton
                      label="apostrophe:removeItem"
                      :icon="field.styles === 'table' ? 'close-icon' : 'trash-can-outline-icon'"
                      type="subtle"
                      :modifiers="['inline', 'danger', 'no-motion']"
                      :icon-only="true"
                      @click="remove(item._id)"
                    />
                  </component>
                </template>
              </AposSchema>
            </component>
          </draggable>
        </component>
        <AposButton
          type="primary"
          label="apostrophe:addItem"
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
import cuid from 'cuid';
import { klona } from 'klona';
import { get } from 'lodash';
import draggable from 'vuedraggable';

export default {
  name: 'AposInputArray',
  components: { draggable },
  mixins: [ AposInputMixin ],
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
      return false;
    },
    async edit() {
      const result = await apos.modal.execute('AposArrayEditor', {
        field: this.field,
        items: this.next,
        serverError: this.serverError,
        docId: this.docId
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
    width: calc(100% + 70px);
    margin: 0 0 10px;
    border-collapse: collapse;
    position: relative;
    left: -35px;

    th {
      padding-left: 10px;
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
      padding-left: 10px;
      padding-bottom: 10px;
      border: 1px solid var(--a-base-9);
      vertical-align: bottom;
      background-color: var(--a-background-primary);
    }
    td.apos-input-array-inline-item-controls {
      border: none;
      background-color: transparent;
    }

    ::v-deep {
      .apos-field__info {
        padding-top: 10px;
      }
      .apos-field__label {
        display: none;
      }
      .apos-input-wrapper {
        padding: 0 4px;
      }
      .apos-schema {
        .apos-field.apos-field--small, .apos-field.apos-field--micro, .apos-field.apos-field--margin-micro {
          margin-bottom: 0;
        }
      }
    }
  }

  .apos-input-array-inline {
    .apos-input-array-inline-collapse {
      position: absolute;
      top: $spacing-quadruple;
      left: 10px;
    }

    .apos-input-array-inline-item {
      ::v-deep .apos-schema {
        position: relative;
        transition: background-color 0.3s ease;
        border-bottom: 1px solid var(--a-base-9);
        &:hover {
          background-color: var(--a-base-10);
        }
        & > div {
          display: none;
        }
        &.apos-input-array-inline-item--active {
          background-color: var(--a-base-10);
          border-bottom: 1px solid var(--a-base-6);
          & > div {
            display: block;
          }
        }
        .apos-input-array-inline-label,
        .apos-input-array-inline-item-controls,
        .apos-input-array-inline-item-controls--remove {
          display: block;
        }
      }
    }
    // ::v-deep .apos-schema {
    //   // .apos-input-array-inline-content-wrapper {
    //   //   padding-top: $spacing-base;
    //   //   padding-bottom: $spacing-base;
    //   // }
    // }

    // .apos-input-array-inline-content-wrapper {
    //   flex-grow: 1;
    // }

    // .apos-input-array-inline-schema-wrapper {
    //   max-height: 999px;
    //   transition: max-height 0.5s;
    // }

    ::v-deep {
      .collapse-enter, .collapse-leave-to {
        max-height: 0;
      }

      .collapse-enter-to, .collapse-leave {
        max-height: 999px;
      }

      .apos-schema {
        display: grid;
        grid-template-columns: 35px auto 35px;
        gap: 5px;
        width: 100%;
        padding-bottom: $spacing-base;
        transition: max-height 0.5s;

        .apos-field.apos-field--small, .apos-field.apos-field--micro, .apos-field.apos-field--margin-micro {
          margin-bottom: 0;
        }

        & > div {
          grid-column: 2;
          padding-top: $spacing-base;
          padding-bottom: $spacing-base;
        }

        .apos-input-array-inline-label {
          transition: background-color 0.3s ease;
          @include type-label;
          margin: 0;
          padding-top: $spacing-base;
          padding-bottom: $spacing-base;
          justify-self: start;
          &:hover {
            cursor: pointer;
          }
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
  }
</style>
