<template>
  <section
    class="apos-layout__grid-clone"
    :class="gridClasses"
    data-apos-test="aposLayoutContainerClone"
    :style="{
      '--grid-columns': gridState.columns,
      '--grid-gap': gridState.options.gap,
    }"
    @mousemove="onMouseMove($event)"
  >
    <div
      v-for="(item) in gridState.current.items"
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
        data-shim
        :data-id="item._id"
        class="apos-layout__item-shim"
      >
        <button
          v-show="!hasMotion"
          class="apos-layout--item-action apos-layout__item-move-handle"
          @mousedown="onStartMove(item, $event)"
          @touchstart="onStartMove(item, $event)"
          @mouseup="resetGhostData"
          @touchend="resetGhostData"
        />
        <button
          v-show="!hasMotion || ghostData.id === item._id"
          class="apos-layout--item-action apos-layout__item-resize-handle nw"
          @mousedown="onStartResize(item, 'west', $event)"
          @touchstart="onStartResize(item, 'west', $event)"
          @mouseup="resetGhostData"
          @touchend="resetGhostData"
        />
        <button
          v-show="!hasMotion || ghostData.id === item._id"
          class="apos-layout--item-action apos-layout__item-resize-handle se"
          @mousedown="onStartResize(item, 'east', $event)"
          @touchstart="onStartResize(item, 'east', $event)"
          @mouseup="resetGhostData"
          @touchend="resetGhostData"
        />
        <div
          v-show="!hasMotion"
          class="apos-layout--item-action apos-layout__item-delete-handle"
        >
          <AposButton
            v-bind="buttonDefaults"
            icon="delete-icon"
            :modifiers="[ 'round', 'tiny', 'icon-only', 'danger' ]"
            @click="removeItem(item)"
          />
        </div>
      </div>
      <div
        data-content
        class="apos-layout__item-content"
      >
        <div
          :style="{
            width: gridContentStyles.get(item._id)?.width || '100%',
            height: gridContentStyles.get(item._id)?.height || '100%'
          }"
        />
      </div>
    </div>
    <!-- Synthetic tiles overlay (click-to-add). Visual only; no resize/move handles. -->
    <template v-if="showSynthetic">
      <div
        v-for="slot in syntheticItems"
        :key="slot._id"
        class="apos-layout__item apos-layout__item-synthetic"
        role="button"
        :style="{
          '--colstart': slot.colstart,
          '--colspan': slot.colspan,
          '--rowstart': slot.rowstart,
          '--rowspan': 1,
          '--order': slot.order,
          '--justify': 'stretch',
          '--align': 'stretch'
        }"
        @click="onAddSynthetic(slot)"
      />
    </template>
    <div
      v-if="hasMotion"
      :style="{
        left: ghostData.left + 'px',
        top: ghostData.top + 'px',
        width: ghostData.width + 'px',
        height: ghostData.height + 'px'
      }"
      class="apos-layout__item-ghost"
    />
    <div
      v-if="hasMotion && typeof ghostData.snapLeft === 'number'"
      :style="{
        left: ghostData.snapLeft + 'px',
        top: ghostData.snapTop + 'px',
        width: ghostData.width + 'px',
        height: ghostData.height + 'px'
      }"
      class="apos-layout__item-ghost snap"
    />
    <div :class="gridOverlayClasses">
      <div
        v-for="(item, i) in columnIndicatorStyles"
        :key="i"
        class="column-indicator"
        :class="item.class"
        :style="item.style"
      />
    </div>
  </section>
</template>

<script>
import { throttle } from 'lodash';
import { GridManager } from '../lib/grid-manager.js';
import {
  getReorderPatch, prepareMoveIndex
} from '../lib/grid-state.mjs';

export default {
  name: 'AposGridManager',
  props: {
    /**
     * The full grid state as produced by itemsToState()
     * @type {import('../lib/grid-state.mjs').GridState}
     */
    gridState: {
      type: Object,
      required: true
    },
    metaId: {
      type: String,
      default: null
    },
    syntheticItems: {
      type: Array,
      default: () => []
    }
  },
  emits: [
    'resize-start',
    'resize-end',
    'move-start',
    'move-end',
    'add-first-item',
    'add-fit-item',
    'remove-item',
    'patch-item',
    'patch-device-item'
  ],
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
        // mouse position inside the item at move start (px)
        clickOffsetX: null,
        clickOffsetY: null,
        side: null,
        id: null,
        element: null,
        top: null,
        left: null,
        width: null,
        height: null,
        snapTop: null,
        snapLeft: null
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
      movePrecomp: null,
      // Recalculate the grid overlay styles
      sceneResizeIndex: 0,
      // Sync the grid content styles
      cloneCalculateIndex: 0,
      addFirstOptions: {
        label: 'Add Column',
        icon: 'plus-icon',
        type: 'primary',
        modifiers: [],
        iconSize: 20,
        disableFocus: false
      },
      buttonDefaults: {
        label: '',
        icon: 'plus-icon',
        type: 'primary',
        modifiers: [ 'round', 'tiny', 'icon-only' ],
        iconOnly: true,
        iconSize: 11
      },
      onMoveDebounced: throttle(this.onMove, 10),
      onResizeDebounced: throttle(this.onResize, 10)
      // gridContentStyles: new Map()
    };
  },
  computed: {
    layoutMode() {
      return this.gridState.layoutMode;
    },
    deviceMode() {
      return this.gridState.deviceMode;
    },
    gridClasses() {
      return {
        manage: true,
        focused: this.isFocusedMode,
        'is-resizing': this.isResizing,
        'is-moving': this.isMoving
      };
    },
    gridOverlayClasses() {
      return {
        'apos-layout__grid-overlay': true,
        active: this.hasMotion
      };
    },
    getItemsClasses() {
      return this.items.map(item => ({
        'apos-layout__item': true,
        'is-resizing': this.isResizing && this.ghostData.id === item._id,
        'is-moving': this.isMoving && this.ghostData.id === item._id
      }));
    },
    isFocusedMode() {
      return this.layoutMode === 'focus';
    },
    isResizing() {
      return this.ghostData.isResizing;
    },
    isMoving() {
      return this.ghostData.isMoving;
    },
    hasMotion() {
      return this.isResizing || this.isMoving;
    },
    showSynthetic() {
      return Array.isArray(this.syntheticItems) &&
        this.syntheticItems.length > 0 &&
        this.hasMotion === false;
    },
    columnIndicatorStyles() {
      if (this.sceneResizeIndex === 0) {
        return new Map();
      }
      return this.manager.getGridColumnIndicatorStylesDebounced(
        this.gridState.columns,
        this.gridState.current.rows
      ) ?? [];
    },
    gridContentStyles() {
      if (this.cloneCalculateIndex === 0) {
        return new Map();
      }
      return this.manager.getGridContentStyles(
        this.$parent.$refs.contentItems
      );
    }
  },
  async mounted() {
    document.addEventListener('keydown', this.onGlobalKeyDown);
    document.addEventListener('mouseup', this.onMouseUp);
    document.addEventListener('touchend', this.onMouseUp);

    this.manager.init(
      this.$parent.$refs.root,
      this.$parent.$refs.grid,
      (type, obj) => {
        if (type === 'resize') {
          this.sceneResizeIndex += 1;
          this.cloneCalculateIndex += 1;
        } else if (type === 'scroll') {
          this.sceneResizeIndex += 1;
        }
      }
    );

    document.addEventListener('scroll', this.manager.onSceneScrollDebounced);
    this.resizeObserver = new ResizeObserver(entries => {
      // Because of hot-reloading, the grid manager may be re-initialized
      // without the resize observer being properly cleaned up.
      this.manager.onSceneResizeDebounced(entries);
    });
    this.resizeObserver.observe(this.$parent.$refs.grid);

    await this.$nextTick();
    this.cloneCalculateIndex += 1;
    this.sceneResizeIndex += 1;
  },
  beforeUnmount() {
    document.removeEventListener('keydown', this.onGlobalKeyDown);
    document.removeEventListener('mouseup', this.onMouseUp);
    document.removeEventListener('touchend', this.onMouseUp);
    document.removeEventListener('scroll', this.manager.onSceneResizeDebounced);
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    this.manager.destroy();
    if (this.onMoveDebounced?.cancel) {
      this.onMoveDebounced.cancel();
    }
  },
  methods: {
    onAddSynthetic(slot) {
      const newItem = {
        colstart: slot.colstart,
        colspan: slot.colspan,
        rowstart: slot.rowstart,
        rowspan: 1
      };
      const patches = getReorderPatch({
        item: newItem,
        state: this.gridState
      });
      this.$emit('add-fit-item', patches);
    },
    onStartResize(item, side, event) {
      event.preventDefault();
      event.stopPropagation();
      const element = this.$refs.items.find(el => el.dataset.id === item._id);
      const itemData = this.gridState.lookup.get(item._id);
      if (!itemData || !element) {
        return;
      }
      this.$emit('resize-start', {
        item: itemData,
        side
      });
      const {
        left, top, width, height
      } = this.manager.getItemOriginalPosition(
        element
      );
      // Placeholder for resize start logic
      const ghostData = {
        isResizing: true,
        isMoving: false,
        startX: event.clientX,
        startY: event.clientY,
        side,
        id: itemData._id,
        element,
        top,
        left,
        width,
        height
      };
      Object.assign(this.ghostData, ghostData);
      this.ghostDataWrite.id = itemData._id;
      this.ghostDataWrite.side = side;
      this.ghostDataWrite.colspan = itemData.colspan;
      this.ghostDataWrite.colstart = itemData.colstart;
      this.ghostDataWrite.rowstart = itemData.rowstart ?? 1;
      this.ghostDataWrite.rowspan = itemData.rowspan ?? 1;
      this.ghostDataWrite.order = itemData.order;
    },
    onResize(event) {
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
    onStartMove(item, event) {
      event.preventDefault();
      event.stopPropagation();
      const element = this.$refs.items.find(el => el.dataset.id === item._id);
      const itemData = this.gridState.lookup.get(item._id);
      if (!itemData || !element) {
        return;
      }
      this.$emit('move-start', {
        item: itemData
      });
      const {
        left, top, width, height
      } = this.manager.getItemOriginalPosition(element);
      this.ghostData = {
        isResizing: false,
        isMoving: false,
        side: null,
        startX: event.clientX,
        startY: event.clientY,
        clickOffsetX: null,
        clickOffsetY: null,
        id: itemData._id,
        element,
        top,
        left,
        width,
        height
      };

      this.ghostDataWrite.id = itemData._id;
      this.ghostDataWrite.side = null;
      this.ghostDataWrite.direction = null;
      this.ghostDataWrite.colspan = itemData.colspan;
      this.ghostDataWrite.colstart = itemData.colstart;
      this.ghostDataWrite.rowstart = itemData.rowstart ?? 1;
      this.ghostDataWrite.rowspan = itemData.rowspan ?? 1;
      this.ghostDataWrite.order = itemData.order;

      this.ghostData.isMoving = true;

      this.movePrecomp = prepareMoveIndex({
        item: this.ghostDataWrite,
        state: this.gridState
      });
    },
    onMove(event) {
      if (!this.isMoving) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      const {
        left, top, snapLeft, snapTop, colstart, rowstart
      } = this.manager.onGhostMove({
        state: this.gridState,
        data: this.ghostData,
        item: this.gridState.lookup.get(this.ghostData.id),
        precomp: this.movePrecomp
      }, event);
      this.ghostData.left = left ?? this.ghostData.left;
      this.ghostData.top = top ?? this.ghostData.top;

      if (typeof snapLeft === 'number' && typeof snapTop === 'number') {
        this.ghostData.snapLeft = snapLeft;
        this.ghostData.snapTop = snapTop;
      }
      if (colstart && rowstart) {
        this.ghostDataWrite.colstart = colstart;
        this.ghostDataWrite.rowstart = rowstart;
      }
    },
    onMouseMove(event) {
      if (this.isResizing) {
        this.onResizeDebounced(event);
      } else if (this.isMoving) {
        this.onMoveDebounced(event);
      }
    },
    onMouseUp(event) {
      if (this.isResizing) {
        this.emitResize();
      }
      if (this.isMoving) {
        this.emitMove();
      }
    },
    onGlobalKeyDown(event) {
      if (this.isResizing || this.isMoving) {
        switch (event.key) {
          case 'Escape':
            this.resetGhostData();
            break;
          case 'Enter': {
            // Direction is set only when mouse is moved after the
            // initial capture of the resize start
            this.isResizing && this.emitResize();
            this.isMoving && this.emitMove();
            break;
          }
        }
      }
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
      this.resetGhostData();
    },
    emitMove() {
      const patches = this.manager.performItemMove({
        data: this.ghostDataWrite,
        state: this.gridState,
        item: this.gridState.lookup.get(this.ghostDataWrite.id),
        precomp: this.movePrecomp
      });
      this.$emit('move-end', patches);
      this.resetGhostData();
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
    },
    addItemFirst() {
      this.$emit('add-first-item', {
        colstart: 1,
        colspan: this.gridState.options.defaultSpan,
        order: 0
      });
    },
    removeItem(item) {
      const patches = getReorderPatch({
        deleted: { _id: item._id },
        state: this.gridState
      });
      this.$emit('remove-item', {
        _id: item._id,
        patches
      });
    },
    patchItem(item, patch) {
      this.$emit('patch-item', {
        ...patch,
        _id: item._id
      });
    },
    toggleDeviceVisibility(item, device) {
      const patch = {
        show: !item[device].show
      };
      this.$emit('patch-device-item', {
        _id: item._id,
        device,
        patch
      });
    }
  }
};
</script>

<style lang="scss" scoped>
/* The base grid styles, mimicking the default public behavior */
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

/*
  Management specific features, enhancing the grid/items
  to deliver management features
*/
.apos-layout {
  &__grid-clone {
    position: absolute;
    inset: 0;
    display: grid;
    grid-template-columns: repeat(var(--grid-columns, 12), 1fr);
    gap: var(--grid-gap);

    & > .apos-layout__item {
      place-self: stretch;
      border-radius: var(--a-border-radius);
    }

    & > .apos-layout__item-content > *{
      pointer-events: none;
    }
  }

  &__grid-clone.manage > &__item {
    position: relative;
    min-height: 150px;
    opacity: 1;
    transition: all 300ms ease;

    &.is-resizing > &__item {
      opacity: 0.2;
    }

    &.is-resizing &__item-shim {
      background-color: rgba($brand-blue, 0.8);
    }
  }

  &__item-shim {
    z-index: $z-index-widget-label;
    position: absolute;
    box-sizing: border-box;
    border: 1px solid var(--a-primary);
    transition: background-color 300ms ease;
    inset: 0;
    border-radius: var(--a-border-radius);
    // background-color: rgba($brand-blue, 0.6);
    background-color: rgba(#fff, 0.4);

    &:hover {
      background-color: rgba(#fff, 0.7);
    }

    &:hover:not(.is-resizing) > .apos-layout--item-action {
      display: block;
    }

    // &.is-resizing {
    //   can be used to style the shim when resizing
    // }
  }

  &__item-synthetic {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    border: 1px dashed var(--a-base-5);
    background-color: var(--a-base-2);
    border-radius: var(--a-border-radius);
    color: var(--a-base-7);
    cursor: pointer;
    transition: opacity 200ms ease;

    &::before {
      content: '+';
      font-size: 1.5rem;
      line-height: 1;
    }
  }

  &__grid-overlay {
    position: absolute;
    // Toggle to initially display or display on move/resize
    display: none;
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

  &__item-ghost {
    z-index: $z-index-manager-toolbar;
    position: absolute;
    width: 500px;
    height: 150px;
    inset: 0;
    background-color: rgba($brand-blue, 0.2);
    border-radius: var(--a-border-radius);
    pointer-events: none;
    transition: all 200ms ease-out;

    &.snap {
      border: none;
      outline: 2px dashed rgba($brand-blue, 0.8);
      // outline-offset: -1px;
      background-color: transparent;
    }
  }

  &--item-action {
    position: absolute;
    display: none;
    border: none;
    background-color: transparent;
    cursor: pointer;
  }
}

.apos-layout__item-resize-handle {
  width: 22px;
  height: 100%;

  &::before,
  &::after {
    content: '';
    position: absolute;
    width: 0;
    height: 0;
    pointer-events: none;
  }

  // south-east corner
  &.se {
    right: 0;
    bottom: 0;
    // cursor: nwse-resize;
    cursor: col-resize;

    // Outer triangle (stroke)
    &::before {
      right: 0;
      bottom: 0;
      border-bottom: 16px solid var(--a-primary);
      border-left: 16px solid transparent;
      filter: drop-shadow(0 1px 2px rgb(0 0 0 / 15%));
    }

    // Inner triangle (fill)
    &::after {
      right: 1px;
      bottom: 1px;
      border-bottom: 14px solid var(--a-background-primary);
      border-left: 14px solid transparent;
    }

    &:hover::before {
      border-bottom-width: 18px;
      border-left-width: 18px;
    }

    &:hover::after {
      right: 2px;
      bottom: 2px;
      border-bottom-width: 16px;
      border-left-width: 16px;
    }
  }

  // north-west corner
  &.nw {
    top: 0;
    left: 0;
    // cursor: nwse-resize;
    cursor: col-resize;

    // Outer triangle (stroke)
    &::before {
      top: 0;
      left: 0;
      border-top: 16px solid var(--a-primary);
      border-right: 16px solid transparent;
      filter: drop-shadow(0 1px 2px rgb(0 0 0 / 15%));
    }

    // Inner triangle (fill)
    &::after {
      top: 1px;
      left: 1px;
      border-top: 14px solid var(--a-background-primary);
      border-right: 14px solid transparent;
    }

    &:hover::before {
      border-top-width: 18px;
      border-right-width: 18px;
    }

    &:hover::after {
      top: 2px;
      left: 2px;
      border-top-width: 16px;
      border-right-width: 16px;
    }
  }
}

.apos-layout__item-move-handle {
  inset: 0 22px;
  cursor: move;
}

.apos-layout__item-delete-handle {
  top: 0;
  right: 0;
  padding: 8px;
}

/* stylelint-disable-next-line media-feature-name-allowed-list */
@media (prefers-reduced-motion: no-preference) {
  .apos-layout__grid-clone {
    transition: all 300ms ease;
  }
}

</style>
