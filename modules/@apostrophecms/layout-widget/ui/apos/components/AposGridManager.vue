<template>
  <div
    ref="root"
    class="apos-layout__root"
  >
    <section
      ref="grid"
      :class="gridClasses"
      data-apos-test="aposLayoutContainer"
      :style="{
        '--grid-columns': gridState.options.columns,
        '--grid-gap': gridState.options.gap,
      }"
      @mousemove="onMouseMove($event)"
    >
      <div
        v-for="(item, i) in gridState.current.items"
        :key="item._id"
        ref="items"
        class="apos-layout__item"
        role="gridcell"
        data-apos-test="aposLayoutItem"
        :data-id="item._id"
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
          v-if="isManageMode"
          class="apos-layout__item-shim"
        >
          <button
            class="apos-layout__item-resize-handle west"
            @mousedown="onStartXResize(item, 'west', $event)"
            @touchstart="onStartXResize(item, 'west', $event)"
            @mouseup="resetGhostData"
            @touchend="resetGhostData"
          />
          <button
            class="apos-layout__item-resize-handle east"
            @mousedown="onStartXResize(item, 'east', $event)"
            @touchstart="onStartXResize(item, 'east', $event)"
            @mouseup="resetGhostData"
            @touchend="resetGhostData"
          />
        </div>
        <slot
          name="item"
          :item="item"
          :i="i"
        />
      </div>
      <div
        v-if="isResizing"
        :style="{
          left: ghostData.left + 'px',
          top: ghostData.top + 'px',
          width: ghostData.width + 'px',
          height: ghostData.height + 'px'
        }"
        class="apos-layout__item-ghost"
      />
      <div
        v-if="isManageMode"
        :class="gridOverlayClasses"
      >
        <div
          v-for="(item, i) in columnIndicatorStyles"
          :key="i"
          class="column-indicator"
          :class="item.class"
          :style="item.style"
        />
      </div>
    </section>
  </div>
</template>

<script>
import { GridManager } from '../lib/grid-manager.js';
import { itemsToState } from '../lib/grid-state.js';
export default {
  name: 'AposGridManager',
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
     * The mode of the grid manager, which can be 'manage', 'focus', 'view'
     */
    layoutMode: {
      type: String,
      default: 'manage'
    },
    deviceMode: {
      type: String,
      default: 'desktop'
    }
  },
  emits: [ 'resize-start', 'resize-end' ],
  data() {
    return {
      manager: new GridManager(),
      // The inital ghost data for resizing.
      // Only ghost related data can be written (such as top, left, width, height).
      ghostData: {
        isResizing: false,
        isMoving: false,
        startX: null,
        startY: null,
        side: null,
        id: null,
        element: null,
        top: null,
        left: null,
        width: null,
        height: null
      },
      // The current item computed changes.
      ghostDataWrite: {
        id: null,
        side: null,
        direction: null,
        colspan: null,
        colstart: null,
        rowstart: null,
        rowspan: null,
        order: null
      },
      sceneResizeIndex: 0
    };
  },
  computed: {
    gridClasses() {
      return {
        'apos-layout': true,
        manage: this.isManageMode,
        focused: this.isFocusedMode,
        'is-resizing': this.isResizing
      };
    },
    gridOverlayClasses() {
      return {
        'apos-layout__grid-overlay': true,
        active: this.isResizing
      };
    },
    getItemsClasses() {
      return this.items.map(item => ({
        'apos-layout__item': true,
        'is-resizing': this.isResizing && this.ghostData.id === item._id
      }));
    },
    gridState() {
      return itemsToState({
        items: this.items,
        options: this.options,
        meta: this.meta,
        layoutMode: this.layoutMode,
        deviceMode: this.deviceMode
      });
    },
    isManageMode() {
      return [ 'manage', 'focus' ].includes(this.layoutMode);
    },
    isFocusedMode() {
      return this.layoutMode === 'focus';
    },
    isResizing() {
      return this.ghostData.isResizing;
    },
    columnIndicatorStyles() {
      return this.manager.getGridColumnIndicatorStyles(
        this.gridState.options.columns,
        this.gridState.current.rows,
        // Here only to force recomputation of the grid styles
        this.sceneResizeIndex
      );
    }
  },
  mounted() {
    this.manager.init(
      this.$refs.root,
      this.$refs.grid,
      () => {
        this.sceneResizeIndex += 1;
      }
    );
    document.addEventListener('keydown', this.onGlobalKeyDown);
    document.addEventListener('mouseup', this.onMouseUp);
    document.addEventListener('touchend', this.onMouseUp);
  },
  unmounted() {
    document.removeEventListener('keydown', this.onGlobalKeyDown);
    document.removeEventListener('mouseup', this.onMouseUp);
    document.removeEventListener('touchend', this.onMouseUp);
    this.manager.destroy();
  },
  methods: {
    onStartXResize(item, side, event) {
      event.preventDefault();
      event.stopPropagation();
      const element = this.$refs.items.find(el => el.dataset.id === item._id);
      const data = {
        startX: event.clientX,
        startY: event.clientY,
        item,
        axis: 'x',
        side,
        element
      };
      this.handleResizeStart(data);
    },
    onMouseMove(event) {
      if (this.isResizing) {
        event.preventDefault();
        event.stopPropagation();
        const {
          left, width, colspan, colstart, direction
        } = this.computeGhostResize(event);
        this.ghostData.left = left ?? this.ghostData.left;
        this.ghostData.width = width ?? this.ghostData.width;

        this.ghostDataWrite.colstart = colstart ?? this.ghostDataWrite.colstart;
        this.ghostDataWrite.colspan = colspan ?? this.ghostDataWrite.colspan;
        this.ghostDataWrite.direction = direction ?? this.ghostDataWrite.direction;
      }
    },
    onMouseUp(event) {
      if (this.isResizing) {
        this.emitResize();
        this.resetGhostData();
      }
    },
    onGlobalKeyDown(event) {
      if (this.isResizing) {
        switch (event.key) {
          case 'Escape':
            this.resetGhostData();
            break;
          case 'Enter': {
            // Direction is set only when mouse is moved after the
            // initial capture of the resize start
            this.emitResize();
            this.resetGhostData();
            break;
          }
        }
      }
    },
    handleResizeStart(data) {
      const itemData = this.gridState.current.items.find(
        item => item._id === data.item._id
      );
      if (!itemData || !data.element) {
        return;
      }
      const {
        left, top, width, height
      } = this.manager.getItemOriginalPosition(
        data.element
      );
      // Placeholder for resize start logic
      const ghostData = {
        isResizing: true,
        isMoving: false,
        startX: data.startX,
        startY: data.startY,
        side: data.side,
        id: data.item._id,
        element: data.element,
        top,
        left,
        width,
        height
      };
      Object.assign(this.ghostData, ghostData);
      this.ghostDataWrite.id = data.item._id;
      this.ghostDataWrite.side = data.side;
      this.ghostDataWrite.colspan = itemData.colspan;
      this.ghostDataWrite.colstart = itemData.colstart;
      this.ghostDataWrite.rowstart = itemData.rowstart ?? 1;
      this.ghostDataWrite.rowspan = itemData.rowspan ?? 1;
      this.ghostDataWrite.order = itemData.order;
    },
    resetGhostData() {
      Object.keys(this.ghostData).forEach(key => {
        this.ghostData[key] = typeof this.ghostData[key] === 'boolean'
          ? false
          : null;
      });
      Object.keys(this.ghostDataWrite).forEach(key => {
        this.ghostDataWrite[key] = null;
      });
    },
    emitResize() {
      // No resize direction, nothing to emit
      if (!this.ghostDataWrite.direction) {
        return;
      }

      const patches = this.manager.performItemResize(
        {
          data: this.ghostDataWrite,
          state: this.gridState,
          item: this.gridState.lookup.get(this.ghostDataWrite.id)
        }
      );
      this.$emit('resize-end', patches);
    },
    computeGhostResize(mouseEvent) {
      const {
        left, width, colspan, colstart, direction
      } = this.manager.onGhostResize(
        {
          state: this.gridState,
          data: this.ghostData,
          item: this.gridState.current.items
            .find(item => item._id === this.ghostData.id)
        },
        mouseEvent
      );
      return {
        direction,
        left,
        width,
        colspan,
        colstart
      };
    }
  }
};
</script>

<style lang="scss" scoped>
/* The base grid styles, mimicking the default public behavior */
.apos-layout {
  display: grid;
  grid-template-columns: repeat(var(--grid-columns, 12), 1fr);
  gap: var(--grid-gap);

  &__item {
    /* stylelint-disable-next-line declaration-block-no-redundant-longhand-properties */
    align-self: var(--align, inherit);
    order: var(--order, 0);
    /* stylelint-disable-next-line declaration-block-no-redundant-longhand-properties */
    grid-column: var(--colstart, auto) / span var(--colspan, 1);
    grid-row: var(--rowstart, auto) / span var(--rowspan, 1);
    /* stylelint-disable-next-line declaration-block-no-redundant-longhand-properties */
    justify-self: var(--justify, inherit);
  }
}

/* Management specific features, enhancing the grid/items
to deliver management features */
.apos-layout__root {
  position: relative;
}

.apos-layout.manage {
  position: relative;
}

.apos-layout__grid-overlay {
  position: absolute;
  // Toggle to initially display or display on move/resize
  // display: none;
  box-sizing: border-box;
  border: 1px dashed rgba($brand-blue, 0.4);
  inset: 0;
  border-radius: var(--a-border-radius);

  &.active {
    display: block;
    pointer-events: none;
  }

  & > .column-indicator {
    position: absolute;
    top: 0;
    bottom: 0;
    box-sizing: border-box;
    width: 2px;
    background-color: rgba($brand-blue, 0.4);
    border-radius: 1px;
  }

   & > .column-indicator.gap {
      border: 1px dashed rgba($brand-blue, 0.4);
      background: repeating-linear-gradient(
        45deg,
        rgba($brand-blue, 0.4) 0 2px,  /* line thickness */
        transparent 2px 12px            /* gap between lines */
      );
   }
}

.apos-layout__item {
  opacity: 1;
  transition: opacity 300ms ease;
}

.apos-layout.is-resizing > .apos-layout__item {
  opacity: 0.2;
}

.apos-layout.manage > .apos-layout__item {
  position: relative;
  border-radius: var(--a-border-radius);
}

.apos-layout.manage > .apos-layout__item > *{
  pointer-events: none;
}

.apos-layout.is-resizing .apos-layout__item-shim {
  background-color: rgba($brand-blue, 0.8);
}

// Set the z-index to SCSS var $z-index-widget-focused-controls + 1
.apos-layout__item-shim {
  z-index: $z-index-widget-label;
  position: absolute;
  inset: 0;
  /* stylelint-disable-next-line declaration-no-important */
  pointer-events: all !important;
  border-radius: var(--a-border-radius);
  background-color: rgba($brand-blue, 0.6);
  transition: background-color 300ms ease;

  &:hover {
    border: 1px dashed rgba($brand-blue, 0.8);
  }

  &:hover:not(.is-resizing) > button {
    display: block;
  }

  // &.is-resizing {
  //   can be used to style the shim when resizing
  // }
}

.apos-layout__item-resize-handle {
  position: absolute;
  top: 0;
  bottom: 0;
  display: none;
  width: 8px;
  background-color: transparent;
  border: none;

  &::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: 3px;
    height: 30px;
    max-width: 3px;
    max-height: 30px;
    border-radius: 2px;
    box-shadow: 0 1px 3px var(--a-primary);
    background-color: var(--a-background-primary);
    transform: translate(-50%, -50%);
    transition: max-width 300ms ease, max-height 400ms ease;
  }

  &::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: 1px;
    height: 15px;
    border-radius: 1px;
    background-color: var(--a-primary);
    transform: translate(-50%, -50%);
  }

  &:hover::before {
    width: 4px;
    height: 40px;
    max-width: 4px;
    max-height: 40px;
  }

  &:hover::after {
    width: 2px;
    height: 21px;
    max-width: 2px;
    max-height: 21px;
  }

  &.east {
    right: 0;
    cursor: col-resize;
  }

  &.west {
    left: 0;
    cursor: col-resize;
  }
}

.apos-layout__item-ghost {
  z-index: $z-index-manager-toolbar;
  position: absolute;
  width: 500px;
  height: 150px;
  // border: 1px dashed rgba($brand-blue, 0.4);
  inset: 0;
  background-color: rgba($brand-blue, 0.3);
  border-radius: var(--a-border-radius);
  pointer-events: none;
  /* stylelint-disable-next-line time-min-milliseconds */
  transition: all 100ms ease-out;
}

/* stylelint-disable-next-line media-feature-name-allowed-list */
@media (prefers-reduced-motion: no-preference) {
  .apos-layout {
    transition: all 300ms ease;
  }
}

</style>
