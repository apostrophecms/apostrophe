<template>
  <div
    ref="root"
    class="apos-layout"
  >
    <TransitionGroup
      ref="grid"
      name="apos-grid"
      tag="section"
      class="apos-layout__grid"
      :class="gridClasses"
      data-apos-test="aposLayoutContainer"
      :style="{
        '--grid-columns': gridState.columns,
        '--grid-gap': gridState.options.gap,
      }"
    >
      <div
        v-for="(item, i) in renderItems"
        :key="item._id"
        ref="contentItems"
        class="apos-layout__item"
        role="gridcell"
        data-apos-test="aposLayoutItem"
        :data-id="`${ item._id }`"
        :style="{
          '--colstart': item.colstart,
          '--colspan': item.colspan,
          '--rowstart': item.rowstart,
          '--rowspan': item.rowspan,
          '--order': item.order,
          '--justify': item.justify,
          '--align': item.align,
        }"
      >
        <div
          data-content
          class="apos-layout__item-content"
        >
          <template v-if="!item.synthetic">
            <slot
              name="item"
              :item="gridState.originalItems.get(item._id)"
              :i="i"
            />
          </template>
          <template v-else>
            <div
              class="apos-layout__item-synthetic"
            >
              <slot
                name="synthetic"
                :item="item"
                :i="i"
              />
            </div>
          </template>
        </div>
      </div>
    </TransitionGroup>
    <AposGridManager
      v-if="isManageMode"
      :grid-state="gridState"
      :synthetic-items="syntheticItems"
      :meta-id="meta._id"
      :opstate="opstate"
      @resize-start="onResizeStart"
      @resize-end="onResizeEnd"
      @move-start="onMoveStart"
      @move-end="onMoveEnd"
      @preview-move="onPreviewMove"
      @preview-clear="onPreviewClear"
      @add-fit-item="onAddFitItem"
      @patch-item="onPatchItem"
    />
  </div>
</template>

<script>
import { itemsToState, computeSyntheticSlots } from '../lib/grid-state.mjs';

export default {
  name: 'AposGridLayout',
  props: {
    options: {
      type: Object,
      required: true
    },
    items: {
      type: Array,
      required: true
    },
    meta: {
      type: Object,
      default: () => ({})
    },
    /**
     * The mode of the grid manager, which can be 'layout', 'focus', 'content'
     */
    layoutMode: {
      type: String,
      default: 'content'
    },
    deviceMode: {
      type: String,
      default: 'desktop'
    },
    // Related to the widget operation state
    opstate: {
      type: Object,
      default: () => ({})
    }
  },
  emits: [
    'resize-end',
    'move-end',
    'add-fit-item',
    'patch-item',
    'remove-item'
  ],
  data() {
    return {
      isResizing: false,
      isMoving: false,
      // Live preview from manager: patches to apply to items for render-only
      preview: {
        patches: null,
        key: null
      }
    };
  },
  computed: {
    gridState() {
      return itemsToState({
        items: this.items,
        options: this.options,
        meta: this.meta,
        layoutMode: this.layoutMode,
        deviceMode: this.deviceMode
      });
    },
    syntheticItems() {
      if (!this.isManageMode) {
        return [];
      }
      const slots = computeSyntheticSlots(this.gridState);
      return slots;
    },
    renderItems() {
      const base = this.gridState.current.items;
      // Apply live preview patches if present (render-only)
      if (Array.isArray(this.preview.patches) && this.preview.patches.length) {
        return this.applyPreviewPatches(base, this.preview.patches);
      }
      if (!this.syntheticItems.length) {
        return base;
      }
      const merged = [
        ...base,
        ...this.syntheticItems
      ];
      return merged.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    },
    isManageMode() {
      return [ 'layout', 'focus' ].includes(this.layoutMode);
    },
    isFocusedMode() {
      return this.layoutMode === 'focus';
    },
    gridClasses() {
      return {
        manage: this.isManageMode,
        focused: this.isFocusedMode,
        'is-resizing': this.isResizing,
        'is-moving': this.isMoving
      };
    }
  },
  methods: {
    onResizeStart() {
      this.isResizing = true;
    },
    onResizeEnd(event) {
      this.isResizing = false;
      this.$emit('resize-end', event);
    },
    onMoveStart() {
      this.isMoving = true;
    },
    onMoveEnd(event) {
      this.isMoving = false;
      this.$emit('move-end', event);
    },
    onAddFitItem(event) {
      this.$emit('add-fit-item', event);
    },
    onPatchItem(event) {
      this.$emit('patch-item', event);
    },
    onPreviewMove({ patches, key }) {
      if (!Array.isArray(patches) || !patches.length) {
        this.onPreviewClear();
        return;
      }
      if (this.preview.key === key) {
        return;
      }
      this.preview = {
        patches,
        key
      };
    },
    onPreviewClear() {
      if (this.preview.patches || this.preview.key) {
        this.preview = {
          patches: null,
          key: null
        };
      }
    },
    applyPreviewPatches(items, patches) {
      // Map items by _id for quick lookup
      const map = new Map(items.map((it, idx) => [ it._id, {
        it,
        idx
      } ]));
      const out = items.map(it => ({ ...it }));
      for (const p of patches) {
        const ref = map.get(p._id);
        if (!ref) {
          continue;
        }
        const target = out[ref.idx];
        // Only apply layout-related fields present in the patch
        if ('colstart' in p) {
          target.colstart = p.colstart;
        }
        if ('rowstart' in p) {
          target.rowstart = p.rowstart;
        }
        if ('colspan' in p) {
          target.colspan = p.colspan;
        }
        if ('rowspan' in p) {
          target.rowspan = p.rowspan;
        }
        if ('order' in p) {
          target.order = p.order;
        }
      }
      return out;
    }
  }
};
</script>

<style lang="scss" scoped>
/* The base grid styles, mimicking the default public behavior */
.apos-layout__grid {
  display: grid;
  grid-template-columns: repeat(var(--grid-columns, 12), 1fr);
  gap: var(--grid-gap);
}

.apos-layout__item {
  /* stylelint-disable-next-line declaration-block-no-redundant-longhand-properties */
  align-self: var(--align, inherit);
  order: var(--order, 0);
  /* stylelint-disable-next-line declaration-block-no-redundant-longhand-properties */
  grid-column: var(--colstart, auto) / span var(--colspan, 1);
  grid-row: var(--rowstart, auto) / span var(--rowspan, 1);
  /* stylelint-disable-next-line declaration-block-no-redundant-longhand-properties */
  justify-self: var(--justify, inherit);
}

.apos-layout__item-content {
  min-height: 150px;
}

/*
  Management specific features, enhancing the grid/items
  to deliver management features
*/
.apos-layout {
  position: relative;

  &__grid.manage > .apos-layout__item {
    pointer-events: none;
  }

  &__grid.manage > .apos-layout__item > *{
    pointer-events: none;
  }

  &__item-synthetic {
    height: 100%;
  }
}

/* stylelint-disable-next-line media-feature-name-allowed-list */
@media (prefers-reduced-motion: no-preference) {
  /* TransitionGroup move/enter/leave animations for grid items */
  // FIXME: casues issues on item resizing/re-rendering, works fine when moving
  .apos-grid-move {
    transition: transform 200ms ease;
  }

  .apos-grid-enter-active,
  .apos-grid-leave-active {
    transition: opacity 200ms ease;
  }

  .apos-grid-enter-from,
  .apos-grid-leave-to {
    opacity: 0.01;
  }
}
</style>
