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
            v-for="(item, index) in items"
            :key="item._id"
            class="apos-input-array-inline-item"
            :class="item.open ? 'apos-input-array-inline-item--active' : null"
          >
            <div class="apos-input-array-inline-item-controls">
              <AposIndicator
                icon="drag-icon"
                class="apos-drag-handle"
              />
              <AposButton
                v-if="item.open && !alwaysExpand"
                class="apos-input-array-inline-collapse"
                :icon-size="20"
                label="apostrophe:close"
                icon="unfold-less-horizontal-icon"
                type="subtle"
                :modifiers="['inline', 'no-motion']"
                :icon-only="true"
                @click="closeInlineItem(item._id)"
              />
            </div>
            <div class="apos-input-array-inline-content-wrapper">
              <h3
                class="apos-input-array-inline-label"
                v-if="!item.open && !alwaysExpand"
                @click="openInlineItem(item._id)"
              >
                {{ getLabel(item._id, index) }}
              </h3>
              <transition name="collapse">
                <div
                  v-show="item.open"
                  class="apos-input-array-inline-schema-wrapper"
                >
                  <AposSchema
                    :schema="field.schema"
                    v-model="item.schemaInput"
                    :trigger-validation="triggerValidation"
                    :utility-rail="false"
                    :generation="generation"
                    :modifiers="['small', 'inverted']"
                    :doc-id="docId"
                  />
                </div>
              </transition>
            </div>
            <div class="apos-input-array-inline-item-controls apos-input-array-inline-item-controls--remove">
              <AposButton
                label="apostrophe:removeItem"
                icon="trash-can-outline-icon"
                type="subtle"
                :modifiers="['inline', 'danger', 'no-motion']"
                :icon-only="true"
                @click="remove(item._id)"
              />
            </div>
          </div>
        </draggable>
        <AposButton
          type="button"
          label="apostrophe:addItem"
          icon="plus-icon"
          :disabled="disableAdd()"
          :modifiers="[ 'block' ]"
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
      return item.schemaInput.data[titleField] || `Item ${index + 1}`;
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
  .apos-input-array-inline-label {
    transition: background-color 0.3s ease;
    @include type-label;
    margin: 0;
    &:hover {
      cursor: pointer;
    }
  }
  .apos-input-array-inline-item {
    position: relative;
    transition: background-color 0.3s ease;
    display: flex;
    border-bottom: 1px solid var(--a-base-9);
    &:hover {
      background-color: var(--a-base-10);
    }
  }
  .apos-input-array-inline-collapse {
    position: absolute;
    top: $spacing-quadruple;
    left: 7.5px;
  }

  .apos-input-array-inline-item--active {
    background-color: var(--a-base-10);
    border-bottom: 1px solid var(--a-base-6);
    .apos-input-array-inline-content-wrapper {
      padding-top: $spacing-base;
      padding-bottom: $spacing-base;
    }
  }
  .apos-input-array-inline-item-controls {
    padding: $spacing-base;
  }

  .apos-input-array-inline-label {
    padding-top: $spacing-base;
    padding-bottom: $spacing-base;
  }

  .apos-input-array-inline-content-wrapper {
    flex-grow: 1;
  }

  .apos-input-array-inline-schema-wrapper {
    max-height: 999px;
    overflow: hidden;
    transition: max-height 0.5s;
  }

  .collapse-enter, .collapse-leave-to {
    max-height: 0;
  }

  .collapse-enter-to, .collapse-leave {
    max-height: 999px;
  }
</style>
