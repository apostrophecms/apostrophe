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
          <div v-for="item in items" :key="item._id" class="apos-input-array-inline-item">
            <div class="apos-input-array-inline-controls">
              <AposIndicator
                icon="drag-icon"
                class="apos-drag-handle"
              />
              <AposButton
                label="apostrophe:removeItem"
                icon="close-icon"
                type="subtle"
                :modifiers="['small', 'no-motion']"
                :icon-only="true"
                @click="remove(item._id)"
              />
            </div>
            <div class="apos-input-array-inline-schema-wrapper">
              <AposSchema
                :schema="field.schema"
                v-model="item.schemaInput"
                :trigger-validation="triggerValidation"
                :utility-rail="false"
                :generation="generation"
                :modifiers="schemaModifiers"
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
    console.log(JSON.stringify(data, null, '  '));
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
    schemaModifiers() {
      return (this.schema.length === 1) ? [ 'hide-label' ] : [];
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
          console.log(JSON.stringify({
            items: this.items,
            next
          }, null, '  '));
          this.next = next;
        }
      }
    }
  },
  methods: {
    validate (value) {
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
    update (items) {
      this.next = items;
    },
    async edit () {
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
<style>
  .apos-is-dragging {
    opacity: 0.5;
    background: var(--a-base-4);
  }
  .apos-input-array-inline-schema-wrapper {
    margin: 8px 0 0 24px;
  }
</style>
