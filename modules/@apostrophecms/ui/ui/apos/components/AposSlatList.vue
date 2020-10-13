
<template>
  <div ref="root">
    <div v-if="field.min || field.max" class="apos-slat-limit">
      <span>{{ items.length }} selected</span>
      <span v-if="field.min">
        min: {{ field.min }}
      </span>
      <span v-if="field.max">
        max: {{ field.max }}
      </span>
    </div>

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
          v-for="item in items"
          class="apos-slat-list__item"
          @remove="remove"
          @engage="engage"
          @disengage="disengage"
          @select="select"
          @move="move"
          @item-clicked="$emit('item-clicked', item)"
          :key="item._id"
          :item="item"
          :class="{'apos-slat-list__item--disabled' : !editable}"
          :engaged="engaged === item._id"
          :parent="listId"
          :slat-count="items.length"
          :removable="removable"
        />
      </transition-group>
    </draggable>

    <div class="apos-slat-status">
      {{ message }}
    </div>
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
    },
    removable: {
      type: Boolean,
      default: true
    },
    field: {
      type: Object,
      default() {
        return {};
      }
    }
  },
  emits: [ 'update', 'item-clicked', 'select' ],
  data() {
    return {
      isDragging: false,
      delayedDragging: false,
      engaged: null,
      message: null
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
        disabled: !this.editable || this.items.length <= 1,
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
    },
    items() {
      this.updateMessage();
    }
  },
  mounted() {
    console.log('sanity check');
    this.updateMessage();
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
    },
    updateMessage() {
      if (this.field.max && this.field.max <= this.items.length) {
        this.message = 'Limit reached!';
      } else {
        this.message = null;
      }
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

  // TODO: Factor this positioning into pieces manager refactor. - AB
  // .apos-modal__rail .apos-slat-list {
  //   padding: 16px;
  // }
  // TODO: Factor this positioning into pieces manager refactor. - AB
  // .apos-modal__rail .apos-slat-list /deep/ .apos-slat {
  //   margin-bottom: 8px;
  // }

  .apos-slat-status {
    text-align: center;
  }

  .apos-slat-limit {
    letter-spacing: 1.5px;
    text-transform: uppercase;
    margin: 10px 0 0;
    text-align: center;

    span {
      margin-right: 10px;
    }
  }
</style>
