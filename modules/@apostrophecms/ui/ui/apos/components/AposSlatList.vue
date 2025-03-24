
<template>
  <div ref="root">
    <draggable
      :id="listId"
      item-key="_id"
      class="apos-slat-list"
      tag="ol"
      role="list"
      :options="dragOptions"
      :list="next"
      @update="update"
    >
      <template #item="{element: item}">
        <transition-group
          type="transition"
          name="apos-flip-list"
        >
          <AposSlat
            :key="item._id"
            class="apos-slat-list__item"
            :item="item"
            :selected="selected === item._id"
            :class="{'apos-slat-list__item--disabled' : disabled, 'apos-input--error': duplicate}"
            :disabled="disabled"
            :engaged="engaged === item._id"
            :parent="listId"
            :slat-count="next.length"
            :removable="removable"
            :relationship-schema="relationshipSchema"
            :editor-label="editorLabel"
            :editor-icon="editorIcon"
            @remove="remove"
            @engage="engage"
            @disengage="disengage"
            @select="select"
            @move="move"
            @item-clicked="$emit('item-clicked', item)"
          />
        </transition-group>
      </template>
    </draggable>
  </div>
</template>

<script>
import { Sortable } from 'sortablejs-vue3';
import { createId } from '@paralleldrive/cuid2';

export default {
  name: 'AposSlatList',
  components: {
    draggable: Sortable
  },
  props: {
    modelValue: {
      type: Array,
      required: true
    },
    disabled: {
      type: Boolean,
      default: false
    },
    removable: {
      type: Boolean,
      default: true
    },
    selected: {
      type: String,
      default: null
    },
    relationshipSchema: {
      type: Array,
      default: () => null
    },
    editorLabel: {
      type: String,
      default: null
    },
    editorIcon: {
      type: String,
      default: null
    },
    duplicate: {
      type: String,
      default: null
    }
  },
  emits: [ 'item-clicked', 'select', 'update:modelValue' ],
  data() {
    return {
      isDragging: false,
      engaged: null,
      next: this.modelValue.slice()
    };
  },
  computed: {
    listId() {
      return `sortableList-${createId()}`;
    },
    dragOptions() {
      return {
        animation: 0,
        disabled: this.disabled || this.next.length <= 1,
        ghostClass: 'apos-is-dragging'
      };
    }
  },
  watch: {
    modelValue() {
      this.next = this.modelValue.slice();
    },
    next(newValue, oldValue) {
      let equal = true;
      if (newValue.length === this.modelValue.length) {
        for (let i = 0; (i < newValue.length); i++) {
          if (
            (newValue[i]._id !== this.modelValue[i]._id) ||
            (newValue[i].title !== this.modelValue[i].title)
          ) {
            equal = false;
            break;
          }
        }
      } else {
        equal = false;
      }
      if (!equal) {
        this.$emit('update:modelValue', this.next);
      }
    }
  },
  methods: {
    update({
      oldIndex, newIndex
    }) {
      this.next.splice(newIndex, 0, this.next.splice(oldIndex, 1)[0]);
      // FIX: swapping the items does not trigger the watcher
      this.next = this.next.slice();
    },
    engage(id) {
      this.engaged = id;
    },
    disengage(id) {
      this.engaged = null;
    },
    select(id) {
      this.$emit('select', id);
    },
    remove(item, focusNext) {
      const itemIndex = this.getIndex(item._id);
      this.next = this.next.filter(i => item._id !== i._id);
      if (focusNext && this.next[itemIndex]) {
        this.focusElement(this.next[itemIndex]._id);
      } else if (focusNext && this.next[itemIndex - 1]) {
        this.focusElement(this.next[itemIndex - 1]._id);
      }
    },

    move(id, dir) {
      const index = this.getIndex(id);
      const target = dir > 0 ? index + 1 : index - 1;
      if (this.next[target]) {
        this.next.splice(target, 0, this.next.splice(index, 1)[0]);
        this.focusElement(id);
      }
    },
    getIndex(id) {
      let i = null;
      this.next.forEach((item, index) => {
        if (item._id === id) {
          i = index;
        }
      });
      return i;
    },
    focusElement(id) {
      if (this.$refs.root.querySelector(`[data-id="${id}"]`)) {
        this.$nextTick(() => {
          this.$refs.root.querySelector(`[data-id="${id}"]`).focus();
        });
      }
    }
  }
};
</script>

<style lang="scss" scoped>
  .apos-slat-list :deep(.apos-slat) {
    margin-bottom: 5px;
    transition: all 400ms;
    max-width: $input-max-width * 0.65;
  }

  .apos-flip-list-leave-to {
    opacity: 0;
  }

  .apos-is-dragging {
    opacity: 0.5;
    background: var(--a-base-4);
  }

  .apos-slat-list {
    @include apos-list-reset();

    & {
      min-height: 20px;
      max-width: $input-max-width;
    }
  }

  .apos-slat-status {
    text-align: center;
  }

  .apos-slat-limit {
    @include type-help;

    & {
      margin: 10px 0 0;
      text-align: center;
    }

    span {
      margin-right: 10px;
    }
  }
</style>
