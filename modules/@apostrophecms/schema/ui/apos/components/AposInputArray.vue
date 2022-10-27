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
        <draggable
          v-if="field.inline"
          class="apos-input-array-inline"
          tag="div"
          role="list"
          :list="items"
          v-bind="dragOptions"
          :id="listId"
        >
          <div
            v-for="item in items"
            :key="item._id"
            class="apos-input-array-inline-item"
          >
            <div class="apos-input-array-inline-item-controls">
              <AposIndicator
                icon="drag-icon"
                class="apos-drag-handle"
              />
            </div>
            <div class="apos-input-array-inline-schema-wrapper">
              <AposSchema
                :schema="effectiveSchema"
                v-model="item.schemaInput"
                :trigger-validation="triggerValidation"
                :utility-rail="false"
                :generation="generation"
                :modifiers="[ 'margin-none' ]"
              />
            </div>
            <div class="apos-input-array-inline-item-controls">
              <AposButton
                label="apostrophe:removeItem"
                icon="close-icon"
                type="subtle"
                :modifiers="['small', 'no-motion']"
                :icon-only="true"
                @click="remove(item._id)"
              />
            </div>
          </div>
        </draggable>
        <AposButton
          type="button"
          label="apostrophe:addItem"
          :icon-only="true"
          icon="plus-icon"
          :disabled="disableAdd()"
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
import draggable from 'vuedraggable';

export default {
  name: 'AposInputArray',
  components: { draggable },
  mixins: [ AposInputMixin ],
  props: {
    generation: {
      type: Number,
      required: false,
      default() {
        return null;
      }
    }
  },
  data () {
    const next = this.getNext();
    const data = {
      next,
      items: expandItems(next)
    };
    return data;
  },
  computed: {
    listId() {
      return `sortableList-${(Math.floor(Math.random() * Math.floor(10000)))}`;
    },
    dragOptions() {
      return {
        disabled: this.field.readOnly || this.next.length <= 1,
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
    effectiveSchema() {
      if (this.field.schema.length === 1) {
        return [
          {
            ...this.field.schema[0],
            hideLabel: true
          }
        ];
      } else {
        return this.field.schema;
      }
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
      this.items = expandItems(this.next);
    },
    items: {
      deep: true,
      handler() {
        if (!this.items.find(item => item.schemaInput.hasErrors)) {
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
        serverError: this.serverError
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
      this.items = this.items.filter(color => color._id !== _id);
    },
    add() {
      this.items.push({
        _id: cuid(),
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

function expandItems(items) {
  return items.map(item => ({
    _id: item._id || cuid(),
    schemaInput: {
      data: item
    }
  }));
}
</script>
<style lang="scss" scoped>
  .apos-is-dragging {
    opacity: 0.5;
    background: var(--a-base-4);
  }
  .apos-input-array-inline-item {
    display: flex;
    margin-bottom: 20px;
    border-left: 1px solid var(--a-base-9);
  }
  .apos-input-array-inline-item-controls {
    // align-self: stretch seems like the answer, but looks bad
    // once the field adds additional height to itself for an error.
    // 15px - 7.5px (padding of icons) = 7.5px
    padding-top: 7.5px;
  }
  .apos-input-array-inline-schema-wrapper {
    flex-grow: 1;
  }
  .apos-drag-handle {
    padding: 7.5px;
  }
</style>
