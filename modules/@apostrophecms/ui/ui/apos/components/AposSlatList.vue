
<template>
  <div ref="root">
    <draggable
      class="apos-slat-list"
      tag="ol"
      role="list"
      :list="items"
      :move="onMove"
      v-bind="dragOptions"
      @start="isDragging=true"
      @end="isDragging=false"
      :id="listId"
    >
      <transition-group type="transition" name="apos-flip-list">
        <AposSlat
          class="apos-slat-list__item"
          @remove="remove"
          @engage="engage"
          @disengage="disengage"
          @move="move"
          v-for="item in items" :key="item._id"
          :item="item"
          :class="{'apos-slat-list__item--disabled' : !editable}"
          :engaged="engaged === item._id"
          :parent="listId"
        />
      </transition-group>
    </draggable>
  </div>
</template>

<script>
import draggable from 'vuedraggable';

export default {
  name: 'AposSlatList',
  components: {
    draggable
  },
  props: {
    initialItems: {
      type: Array,
      required: true
    },
    editable: {
      type: Boolean,
      default: true
    }
  },
  emits: [ 'update' ],
  data() {
    return {
      isDragging: false,
      delayedDragging: false,
      engaged: null
    };
  },
  computed: {
    items() {
      return this.initialItems;
    },
    listId() {
      return `sortableList-${(Math.floor(Math.random() * Math.floor(10000)))}`;
    },
    dragOptions() {
      return {
        animation: 0,
        disabled: !this.editable,
        ghostClass: 'is-dragging'
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
    }
  },
  methods: {
    engage(id) {
      this.engaged = id;
    },
    disengage(id) {
      this.engaged = null;
    },
    remove(item, focusNext) {
      const itemIndex = this.getIndex(item._id);
      const items = this.items.filter(i => item._id !== i._id);
      this.$emit('update', items);
      if (focusNext && items[itemIndex]) {
        this.focusElement(items[itemIndex]._id);
        return;
      }
      if (focusNext && items[itemIndex - 1]) {
        this.focusElement(items[itemIndex - 1]._id);
      }
    },
    move (id, dir) {
      const index = this.getIndex(id);
      const target = dir > 0 ? index + 1 : index - 1;
      if (this.items[target]) {
        this.items.splice(target, 0, this.items.splice(index, 1)[0]);
        this.focusElement(id);
      }
    },
    getIndex(id) {
      let i = null;
      this.items.forEach((item, index) => {
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
  .apos-slat-list /deep/ .apos-slat {
    margin-bottom: 5px;
    transition: all 0.4s;
  }

  .apos-flip-list-leave-to {
    opacity: 0;
  }

  .is-dragging {
    opacity: 0.5;
    background: var(--a-base-4);
  }

  .apos-slat-list {
    @include apos-list-reset();
    min-height: 20px;
    max-width: $input-max-width * 0.75;
  }

  .apos-modal__rail .apos-slat-list {
    padding: 5px;
  }
</style>
