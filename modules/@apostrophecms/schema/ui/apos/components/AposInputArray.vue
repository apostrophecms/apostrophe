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
      <div v-if="field.inline" class="apos-input-array-inline">
        <div v-for="item in items" :key="item._id">
          <AposSchema
            :schema="field.schema"
            v-model="item.schemaInput"
            :trigger-validation="triggerValidation"
            :utility-rail="false"
            :generation="generation"
          />
          <div>
            <button @click="moveUp(item._id)" :disabled="disableMoveUp(item._id)">
              Up
            </button>
            <button @click="moveDown(item._id)" :disabled="disableMoveDown(item._id)">
              Down
            </button>
            <button @click="remove(item._id)">
              Trash
            </button>
          </div>
        </div>
        <AposButton
          type="button"
          label="+"
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

export default {
  name: 'AposInputArray',
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
    return {
      next,
      items: expandItems(next)
    };
  },
  computed: {
    editLabel () {
      return {
        key: 'apostrophe:editType',
        type: this.$t(this.field.label)
      };
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
          this.next = this.items.map(item => ({
            ...item.data,
            _id: item._id
          }));
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
    disableMoveUp(_id) {
      const index = this.items.findIndex(color => color._id === _id);
      return index === 0;
    },
    disableMoveDown(_id) {
      const index = this.items.findIndex(color => color._id === _id);
      return (index + 1) === this.items.length;
    },
    disableAdd() {
      return this.field.max && (this.items.length >= this.field.max);
    },
    moveUp(_id) {
      const index = this.items.findIndex(color => color._id === _id);
      this.items = [
        ...this.items.slice(0, index - 1),
        this.items[index],
        this.items[index - 1],
        ...this.items.slice(index + 1)
      ];
    },
    moveDown(_id) {
      const index = this.items.findIndex(color => color._id === _id);
      this.items = [
        ...this.items.slice(0, index),
        this.items[index + 1],
        this.items[index],
        ...this.items.slice(index + 2)
      ];
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
      data: {
        item
      }
    }
  }));
}
</script>
