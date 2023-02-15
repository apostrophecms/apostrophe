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
        <table class="apos-table" v-if="items.length">
          <thead>
            <tr class="apos-input-array-inline-header">
              <th class="apos-table-head--hidden" />
              <th
                v-for="schema in field.schema"
                :key="schema._id"
                class="apos-table-head"
              >
                {{ $t(schema.label) }}
              </th>
            </tr>
          </thead>
          <draggable
            :disabled="!field.draggable"
            class="apos-input-array-inline"
            tag="tbody"
            role="list"
            :list="items"
            v-bind="dragOptions"
            :id="listId"
          >
            <tr
              v-for="item in items"
              :key="item._id"
              class="apos-input-array-inline-item"
            >
              <td class="apos-table-cell--hidden">
                <close-icon @click="remove(item._id)" />
              </td>
              <td
                v-for="schema in field.schema"
                :key="schema._id"
                class="apos-table-cell"
              >
                <AposSchema
                  :schema="[schema]"
                  v-model="item.schemaInput"
                  :trigger-validation="triggerValidation"
                  :utility-rail="false"
                  :generation="generation"
                  :modifiers="['small', 'inline']"
                  :doc-id="docId"
                />
              </td>
            </tr>
          </draggable>
        </table>
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

export default {
  name: 'AposInputArray',
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
        const next = this.items.map((item) => ({
          ...item.schemaInput.data,
          _id: item._id,
          metaType: 'arrayItem',
          scopedArrayName: this.field.scopedArrayName
        }));
        this.next = next;
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
      if (this.items.find((item) => item.schemaInput.hasErrors)) {
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
      return this.value && Array.isArray(this.value.data)
        ? this.value.data
        : this.field.def || [];
    },
    disableAdd() {
      return this.field.max && this.items.length >= this.field.max;
    },
    remove(_id) {
      this.items = this.items.filter((item) => item._id !== _id);
    },
    add() {
      const _id = cuid();
      this.items.push({
        _id,
        schemaInput: {
          data: this.newInstance()
        }
      });
    },
    newInstance() {
      const instance = {};
      for (const field of this.field.schema) {
        if (field.def !== undefined) {
          instance[field.name] = klona(field.def);
        }
      }
      return instance;
    }
  }
};

function modelItems(items, field) {
  return items.map((item) => {
    return {
      _id: item._id || cuid(),
      schemaInput: {
        data: item
      }
    };
  });
}
</script>
<style lang="scss" scoped>
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

::v-deep .apos-table {
  .apos-field__info, .apos-field__error, .apos-context-menu, .apos-slat__secondary {
    display: none;
  }
  .apos-table-cell .apos-schema .apos-field {
    margin: 5px;
  }
  .apos-input-array-inline-label {
    transition: background-color 0.3s ease;
    @include type-label;
    margin: 0;
    &:hover {
      cursor: pointer;
    }
  }
  .apos-field--inline .apos-input-wrapper {
    width: 130px;
    height: 36px;
  }
  .apos-input-relationship__items {
    margin-top: 0;
  }
  .apos-input {
    padding-right: 0;
  }
}
.apos-table {
  position: relative;
  left: -30px;
}
.apos-table-cell--hidden {
  background-color: var(--a-white);
  padding-left: 5px;
  cursor: pointer;
}
.apos-table, .apos-table-head, .apos-table-cell {
  @include type-label;
  width: auto;
  border: 1px solid var(--a-base-9);
}
.apos-table, .apos-input-array-inline-item {
  border: none;
}
.apos-input-array-inline-header {
  height: 40px;
}
.apos-table-head {
  background-color: var(--a-base-10);
  text-align: left;
  padding-left: 10px;
}
.apos-table-cell {
  background-color: var(--a-background-primary);
}
</style>
