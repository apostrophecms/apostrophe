<template>
  <div
    ref="root"
    class="apos-layout"
  >
    <section
      ref="grid"
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
    </section>
    <AposGridManager
      v-if="isManageMode"
      :grid-state="gridState"
      :synthetic-items="syntheticItems"
      :meta-id="meta._id"
      :opstate="opstate"
      @resize-start="isResizing = true"
      @resize-end="$emit('resize-end', $event); isResizing = false"
      @move-start="isMoving = true"
      @move-end="$emit('move-end', $event); isMoving = false"
      @add-fit-item="$emit('add-fit-item', $event)"
      @patch-item="$emit('patch-item', $event)"
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
      isMoving: false
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
      if (!this.syntheticItems.length) {
        return this.gridState.current.items;
      }
      // Merge and sort by order to ensure CSS order consistency
      const merged = [
        ...this.gridState.current.items,
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

  &__grid.manage > .apos-layout__item > *{
    pointer-events: none;
  }

  &__item-synthetic {
    height: 100%;
  }
}

/* stylelint-disable-next-line media-feature-name-allowed-list */
@media (prefers-reduced-motion: no-preference) {
  .apos-layout__grid {
    transition: all 300ms ease;
  }
}

</style>
