
<template>
  <div ref="root">
    <draggable
      v-bind="dragOptions"
      :id="listId"
      class="apos-slat-list"
      tag="ol"
      role="list"
      :list="next"
      :move="onMove"
      @start="isDragging=true"
      @end="isDragging=false"
    >
      <transition-group type="transition" name="apos-flip-list">
        <AposSlat
          v-for="item in next"
          :key="item._id"
          class="apos-slat-list__item"
          :item="item"
          :selected="selected === item._id"
          :class="{'apos-slat-list__item--disabled' : disabled, 'apos-input--error': duplicate}"
          :disabled="disabled"
          @remove="remove"
          :engaged="engaged === item._id"
          @engage="engage"
          :parent="listId"
          @disengage="disengage"
          :slat-count="next.length"
          @select="select"
          :removable="removable"
          @move="move"
          :relationship-schema="relationshipSchema"
          @item-clicked="$emit('item-clicked', item)"
          :editor-label="editorLabel"
          :editor-icon="editorIcon"
        />
      </transition-group>
    </draggable>
  </div>
</template>

<script>
import draggable from 'vuedraggable';
import cuid from 'cuid';

export default {
  name: 'AposSlatList',
  components: {
    draggable
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
  emits: [ 'update', 'item-clicked', 'select', 'input' ],
  data() {
    return {
      isDragging: false,
      delayedDragging: false,
      engaged: null,
      next: this.modelValue.slice()
    };
  },
  computed: {
    listId() {
      return `sortableList-${cuid()}`;
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
    isDragging(newValue) {
      if (newValue) {
        this.delayedDragging = true;
        return;
      }
      this.$nextTick(() => {
        this.delayedDragging = false;
      });
    },
    value() {
      this.next = this.modelValue.slice();
    },
    next(newValue, oldValue) {
      let equal = true;
      if (newValue.length === this.modelValue.length) {
        for (let i = 0; (i < newValue.length); i++) {
          if ((newValue[i]._id !== this.modelValue[i]._id) || (newValue[i].title !== this.modelValue[i].title)) {
            equal = false;
            break;
          }
        }
      } else {
        equal = false;
      }
      if (!equal) {
        this.$emit('input', this.next);
      }
    }
  },
  methods: {
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
      this.$emit('update', this.next);
    },
    move(id, dir) {
      const index = this.getIndex(id);
      const target = dir > 0 ? index + 1 : index - 1;
      if (this.next[target]) {
        this.next.splice(target, 0, this.next.splice(index, 1)[0]);
        this.focusElement(id);
        return this.$emit('update', this.next);
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
    },
    onMove({ relatedContext, draggedContext }) {
      const relatedElement = relatedContext.element;
      const draggedElement = draggedContext.element;
      return (
        (!relatedElement || !relatedElement.fixed) && !draggedElement.fixed
      );
    }
  }
};
</script>

<style lang="scss" scoped>
  .apos-slat-list ::v-deep .apos-slat {
    margin-bottom: 5px;
    transition: all 0.4s;
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
    min-height: 20px;
    max-width: $input-max-width;
  }

  .apos-slat-status {
    text-align: center;
  }

  .apos-slat-limit {
    @include type-help;
    margin: 10px 0 0;
    text-align: center;

    span {
      margin-right: 10px;
    }
  }
</style>
