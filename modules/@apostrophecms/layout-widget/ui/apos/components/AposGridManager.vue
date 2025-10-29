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
      v-for="(item) in managerItems"
      :key="item._id"
      ref="items"
      class="apos-layout__item"
      role="gridcell"
      data-apos-test="aposManageLayoutItem"
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
        v-if="!isMoving"
        data-shim
        :data-id="item._id"
        class="apos-layout__item-shim"
      >
        <button
          v-show="!hasMotion"
          class="apos-layout--item-action apos-layout__item-move-handle"
          data-apos-test="moveHandle"
          @mousedown="onStartMove(item, $event)"
          @touchstart="onStartMove(item, $event)"
          @mouseup="resetGhostData"
          @touchend="resetGhostData"
        />
        <button
          v-show="!hasMotion"
          class="apos-layout--item-action apos-layout__item-resize-handle nw"
          data-apos-test="resizeHandleWest"
          @mousedown="onStartResize(item, 'west', $event)"
          @touchstart="onStartResize(item, 'west', $event)"
          @mouseenter="positionResizeUI"
          @mousemove="positionResizeUI"
          @mouseup="resetGhostData"
          @touchend="resetGhostData"
        >
          <span class="apos-layout__item-resize-handle-highlight-bar" />
          <AposIndicator
            icon="drag-vertical-icon"
            :icon-size="20"
            icon-color="var(--a-base-1)"
            class="apos-layout__item-resize-handle-icon"
            data-resize-ui="west"
          />
        </button>
        <button
          v-show="!hasMotion"
          class="apos-layout--item-action apos-layout__item-resize-handle se"
          data-apos-test="resizeHandleEast"
          @mousedown="onStartResize(item, 'east', $event)"
          @touchstart="onStartResize(item, 'east', $event)"
          @mouseenter="positionResizeUI"
          @mousemove="positionResizeUI"
          @mouseup="resetGhostData"
          @touchend="resetGhostData"
        >
          <span class="apos-layout__item-resize-handle-highlight-bar" />
          <AposIndicator
            icon="drag-vertical-icon"
            :icon-size="20"
            icon-color="var(--a-base-1)"
            class="apos-layout__item-resize-handle-icon"
            data-resize-ui="east"
          />
        </button>
        <div
          v-show="!hasMotion"
          class="apos-layout--item-action apos-layout__item-operations-handle"
          data-apos-test="layout-operations"
        >
          <!-- Show breadcrumb operations, no support for actions, just our custom
         expected operations - remove, update and move raw events -->
          <AposBreadcrumbOperations
            v-if="opstate.operations?.length > 0"
            :i="item.__naturalIndex"
            :widget="item"
            :options="opstate.options"
            :is-focused="true"
            :skip-info="true"
            :disabled="opstate.disabled"
            :teleport-modals="true"
            @update="updateItem"
            @operation="onBreadcrumbOperation(item, $event)"
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
      <button
        v-for="slot in syntheticItems"
        :key="slot._id"
        class="apos-layout__item apos-layout__item-synthetic"
        :class="[{'apos-layout__item-synthetic--toosmall': slot.toosmall}]"
        :data-apos-test="`${slot.toosmall ? 'syntheticTooSmall' : 'syntheticSlot'}`"
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
        @click="slot.toosmall ? null : onAddSynthetic(slot)"
      >
        <AposIndicator
          v-if="slot.toosmall"
          icon="cancel-icon"
          icon-color="var(--a-danger)"
          :icon-size="24"
          :tooltip="'apostrophe:layoutColumnTooSmall'"
          class="apos-admin-bar__title__indicator"
        />
      </button>
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
    >
      <div
        v-if="ghostData.id"
        class="apos-layout__item-shim apos-layout__item-shim--ghost"
        :class="{
          'is-resizing': isResizing,
          'is-moving': isMoving
        }"
      >
        <button
          v-if="isMoving"
          type="button"
          class="apos-layout--item-action apos-layout__item-move-handle apos-layout--item-action--ghost"
          disabled
          aria-hidden="true"
          tabindex="-1"
        >
          <AposIndicator
            icon="cursor-move-icon"
            :icon-size="16"
            icon-color="var(--a-base-1)"
            class="apos-layout__item-move-handle-icon"
          />
        </button>
        <button
          v-if="isResizing"
          type="button"
          class="apos-layout--item-action apos-layout__item-resize-handle nw apos-layout__item-resize-handle--ghost"
          disabled
          aria-hidden="true"
          tabindex="-1"
        >
          <span
            v-show="ghostData.side === 'west'"
            class="apos-layout__item-resize-handle-highlight-bar"
          />
          <AposIndicator
            v-show="ghostData.side === 'west'"
            icon="drag-vertical-icon"
            :icon-size="20"
            icon-color="var(--a-base-1)"
            class="apos-layout__item-resize-handle-icon"
            data-resize-ui="west"
            :style="ghostResizeIndicatorStyle('west')"
          />
        </button>
        <button
          v-if="isResizing"
          type="button"
          class="apos-layout--item-action apos-layout__item-resize-handle se apos-layout__item-resize-handle--ghost"
          disabled
          aria-hidden="true"
          tabindex="-1"
        >
          <span
            v-show="ghostData.side === 'east'"
            class="apos-layout__item-resize-handle-highlight-bar"
          />
          <AposIndicator
            v-show="ghostData.side === 'east'"
            icon="drag-vertical-icon"
            :icon-size="20"
            icon-color="var(--a-base-1)"
            class="apos-layout__item-resize-handle-icon"
            data-resize-ui="east"
            :style="ghostResizeIndicatorStyle('east')"
          />
        </button>
      </div>
    </div>
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
import { GridManager } from '../lib/grid-manager.js';
import {
  getReorderPatch, prepareMoveIndex
} from '../lib/grid-state.mjs';

const RESIZE_ICON_HEIGHT = 32;

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
    },
    // Related to the widget operation state
    opstate: {
      type: Object,
      default: () => ({})
    },
    // Preview state for synchronizing manager with layout during moves
    preview: {
      type: Object,
      default: () => ({
        patches: null,
        key: null
      })
    }
  },
  emits: [
    'resize-start',
    'resize-end',
    'move-start',
    'move-end',
    'preview-move',
    'preview-clear',
    'add-fit-item',
    'remove-item',
    'patch-item'
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
        snapLeft: null,
        moveSnapMemo: null
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
      lastPreviewKey: null,
      ghostHandleOffsets: {
        west: null,
        east: null
      },
      // RAF coalescing
      rafId: null,
      lastEvent: null
    };
  },
  computed: {
    layoutMode() {
      return this.gridState.layoutMode;
    },
    deviceMode() {
      return this.gridState.deviceMode;
    },
    // Apply preview patches to manager items to keep them synchronized with layout grid
    managerItems() {
      const base = this.gridState.current.items;
      // Apply live preview patches if present (same logic as AposGridLayout)
      if (
        this.isMoving &&
        Array.isArray(this.preview.patches) &&
        this.preview.patches.length
      ) {
        return this.applyPreviewPatches(base, this.preview.patches);
      }
      return base;
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

    const rootEl = this.$parent.$refs.root?.$el || this.$parent.$refs.root;
    const gridRef = this.$parent.$refs.grid;
    const gridEl = gridRef && gridRef.$el ? gridRef.$el : gridRef;

    this.manager.init(
      rootEl,
      gridEl,
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
    if (gridEl) {
      this.resizeObserver.observe(gridEl);
    }

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
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.lastEvent = null;
  },
  methods: {
    onBreadcrumbOperation(item, { name, payload }) {
      if (
        name === 'move' &&
        [ 'mousedown', 'touchstart' ].includes(payload.data.eventName)
      ) {
        this.onStartMove(item, payload.data.event);
      }
    },
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

      this.resetGhostHandleOffsets();
      const pointerY = this.getPointerClientY(event);
      if (typeof pointerY === 'number') {
        this.updateGhostResizeGrip(side, pointerY);
      }
    },
    onResize(event) {
      if (!this.isResizing) {
        return;
      }

      const {
        left, width, colspan, colstart, direction
      } = this.computeGhostResize(event);
      this.ghostData.left = left ?? this.ghostData.left;
      this.ghostData.width = width ?? this.ghostData.width;

      this.ghostDataWrite.colstart = colstart ?? this.ghostDataWrite.colstart;
      this.ghostDataWrite.colspan = colspan ?? this.ghostDataWrite.colspan;
      this.ghostDataWrite.direction = direction ?? this.ghostDataWrite.direction;

      const pointerY = this.getPointerClientY(event);
      if (typeof pointerY === 'number' && this.ghostData.side) {
        this.updateGhostResizeGrip(this.ghostData.side, pointerY);
      }
    },
    onStartMove(item, event) {
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

      this.resetGhostHandleOffsets();
    },
    onMove(event) {
      if (!this.isMoving) {
        return;
      }
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
        // Emit preview of would-be state when snap target changes
        const newKey = `${colstart}:${rowstart}`;
        if (
          typeof this.ghostData.snapLeft === 'number' &&
          typeof this.ghostData.snapTop === 'number'
        ) {
          if (this.lastPreviewKey !== newKey) {
            const patches = this.manager.performItemMove({
              data: this.ghostDataWrite,
              state: this.gridState,
              item: this.gridState.lookup.get(this.ghostDataWrite.id),
              precomp: this.movePrecomp
            });
            if (Array.isArray(patches) && patches.length) {
              this.$emit('preview-move', {
                patches,
                key: newKey
              });
              this.lastPreviewKey = newKey;
            } else if (this.lastPreviewKey) {
              // No effective change, clear existing preview
              this.$emit('preview-clear');
              this.lastPreviewKey = null;
            }
          }
        } else if (this.lastPreviewKey) {
          // Lost snapping, clear preview
          this.$emit('preview-clear');
          this.lastPreviewKey = null;
        }
      }
    },
    onMouseMove(event) {
      if (!this.isResizing && !this.isMoving) {
        return;
      }
      this.lastEvent = event;
      if (this.rafId) {
        return;
      }
      this.rafId = requestAnimationFrame(() => {
        this.rafId = null;
        const ev = this.lastEvent;
        this.lastEvent = null;
        if (!ev) {
          return;
        }
        if (this.isResizing) {
          this.onResize(ev);
        } else if (this.isMoving) {
          this.onMove(ev);
        }
      });
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
      if (this.rafId) {
        cancelAnimationFrame(this.rafId);
        this.rafId = null;
      }
      this.lastEvent = null;
      if (this.lastPreviewKey) {
        this.$emit('preview-clear');
        this.lastPreviewKey = null;
      }
      Object.keys(this.ghostData).forEach(key => {
        this.ghostData[key] = typeof this.ghostData[key] === 'boolean'
          ? false
          : null;
      });
      Object.keys(this.ghostDataWrite).forEach(key => {
        this.ghostDataWrite[key] = null;
      });
      this.resetGhostHandleOffsets();
    },
    emitResize() {
      // No resize direction, nothing to emit
      if (!this.ghostDataWrite.direction) {
        this.resetGhostData();
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
    updateItem(data) {
      const { align, justify } = (data[this.gridState.deviceMode] || {});
      const patch = {
        mobile: {
          show: data.mobile?.show ?? true
        },
        tablet: {
          show: data.tablet?.show ?? true
        }
      };
      patch[this.gridState.deviceMode] ||= {};
      patch[this.gridState.deviceMode].align = align;
      patch[this.gridState.deviceMode].justify = justify;
      this.patchItem(data, patch);
    },
    patchItem(item, patch) {
      this.$emit('patch-item', {
        ...patch,
        _id: item._id,
        __naturalIndex: item.__naturalIndex
      });
    },
    positionResizeUI(e) {
      const rect = e.target.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const grip = e.target.querySelector('[data-resize-ui]');
      if (grip) {
        const height = grip.getBoundingClientRect().height;
        grip.style.top = `${y - (height / 2)}px`;
      } else {
        // should never be missing!
      }
    },
    resetGhostHandleOffsets() {
      this.ghostHandleOffsets.west = null;
      this.ghostHandleOffsets.east = null;
    },
    updateGhostResizeGrip(side, pointerY) {
      if (typeof pointerY !== 'number') {
        return;
      }
      const effectiveHeight = this.ghostData.height ||
        this.ghostData.element?.getBoundingClientRect();
      if (!effectiveHeight) {
        return;
      }
      const containerTop = this.manager.getGridBoundingRect()?.top ?? 0;
      const itemTop = this.ghostData.top ?? 0;
      const pointerWithinItem = pointerY - containerTop - itemTop;
      this.ghostHandleOffsets[side] = Math.min(
        Math.max(pointerWithinItem, 0),
        effectiveHeight
      );
    },
    ghostResizeIndicatorStyle(side) {
      const key = side === 'west' ? 'west' : 'east';
      const fallbackHeight = this.ghostData.height ??
        this.ghostData.element?.getBoundingClientRect().height ??
        RESIZE_ICON_HEIGHT;
      const offset = this.ghostHandleOffsets[key];
      if (offset == null) {
        return {};
      }
      const availableHeight = fallbackHeight ?? RESIZE_ICON_HEIGHT;
      const halfIcon = RESIZE_ICON_HEIGHT / 2;
      const maxTop = availableHeight > RESIZE_ICON_HEIGHT
        ? availableHeight - RESIZE_ICON_HEIGHT
        : 0;
      const top = Math.min(
        Math.max(offset - halfIcon, 0),
        maxTop
      );
      return {
        top: `${top}px`
      };
    },
    getPointerClientY(event) {
      if (!event) {
        return null;
      }
      if (typeof event.clientY === 'number') {
        return event.clientY;
      }
      const touch = event.touches?.[0] || event.changedTouches?.[0];
      if (touch && typeof touch.clientY === 'number') {
        return touch.clientY;
      }
      return null;
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
$resize-ui-width: 12px;
$resize-ui-height: 32px;
$resize-button-width: 4px;
$resize-ui-z-index: 2;

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
    display: grid;
    inset: 0;
    grid-template-columns: repeat(var(--grid-columns, 12), 1fr);
    grid-template-rows: repeat(var(--grid-rows), auto);
    grid-gap: var(--grid-gap, 0);

    &.is-moving,
    &.is-resizing {
      cursor: grabbing;

      // stylelint-disable max-nesting-depth
      .apos-layout__item {
        background-color: rgba(#fff, 0.7);
      }
    }

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
    border: 1px solid var(--a-primary-transparent-50);
    inset: 0;
    background-color: rgba(#fff, 0.7);
    transition: background-color 200ms ease-out;

    &:hover {
      background-color: rgba(#000, 0.3);
    }

    &:hover:not(.is-resizing) > .apos-layout--item-action {
      display: block;
    }
  }

  // Contains button reset styles
  &__item-synthetic {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    margin: 0;
    padding: 0;
    border: 1px dashed var(--a-primary-light-40);
    background-color: var(--a-primary-transparent-15);
    border-radius: var(--a-border-radius);
    color: var(--a-primary);
    font-family: inherit;
    font-size: inherit;
    text-align: center;
    opacity: 0;
    cursor: pointer;
    appearance: none;
    transition: opacity 200ms ease;

    &:hover {
      opacity: 1;
    }

    &::before {
      content: '+';
      font-size: 1.5rem;
      line-height: 1;
    }

    &--toosmall {
      $notallowed: #ff9d9833;

      & {
        border: none;
        background-color: $notallowed;
        color: var(--a-base-3);
        cursor: not-allowed;

        &::before {
          content: ''
        }
      }
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
      background-color: transparent;
    }
  }

  &__item-ghost > .apos-layout__item-shim--ghost {
    position: absolute;
    inset: 0;
    border: 1px solid var(--a-primary-transparent-50);
    border-radius: var(--a-border-radius);
    background-color: transparent;
    pointer-events: none;
  }

  &__item-ghost > .apos-layout__item-shim--ghost.is-resizing {
    background-color: rgba($brand-blue, 0.15);
  }

  &__item-ghost > .apos-layout__item-shim--ghost .apos-layout--item-action {
    display: block;
    pointer-events: none;
  }

  &--item-action {
    position: absolute;
    display: none;
    border: none;
    background-color: transparent;
    cursor: pointer;
  }
}

.apos-layout__item-shim--ghost.is-moving .apos-layout__item-move-handle-icon {
  opacity: 1;
}

.apos-layout__item-shim--ghost.is-resizing .apos-layout__item-resize-handle--ghost .apos-layout__item-resize-handle-highlight-bar,
.apos-layout__item-shim--ghost.is-resizing .apos-layout__item-resize-handle--ghost .apos-layout__item-resize-handle-icon {
  opacity: 1;
}

.apos-layout__item-resize-handle--ghost {
  pointer-events: none;
}

.apos-layout__item-resize-handle-highlight-bar {
  position: absolute;
  top: 0;
  display: block;
  width: $resize-button-width;
  height: 100%;
  background-color: var(--a-primary);
  opacity: 0;
}

.apos-layout--item-action :deep(.apos-area-widget__breadcrumbs.apos-breadcrumb-operations) {
  margin-left: 0;
}

.apos-layout__item-resize-handle {
  $anchor-size: 8px;

  width: $resize-button-width;
  height: 100%;

  // The before/after els draw square resize handles
  &::before,
  &::after {
    z-index: $z-index-default;
    content: '';
    position: absolute;
    width: $anchor-size;
    height: $anchor-size;
    outline: 1px solid var(--a-base-5);
    background-color: var(--a-base-10);
    pointer-events: none;
  }

  &:hover {
    .apos-layout__item-resize-handle-icon,
    .apos-layout__item-resize-handle-highlight-bar {
      opacity: 1;
    }
  }

  // south-east corner
  &.se {
    right: -1 * (math.div($resize-button-width, 2));
    bottom: 0;
    cursor: grab;

    .apos-layout__item-resize-handle-highlight-bar {
      right: -1 * (math.div($resize-button-width, 2) - 1);
    }

    &::before,
    &::after {
      right: -1 * (math.div($anchor-size, 2) - 1);
    }

    &::before {
      top: -1 * math.div($anchor-size, 2);
    }

    &::after {
      bottom: -1 * math.div($anchor-size, 2);
    }
  }

  // north-west corner
  &.nw {
    top: 0;
    left: -1 * (math.div($resize-button-width, 2));
    cursor: grab;

    .apos-layout__item-resize-handle-highlight-bar {
      left: -1 * (math.div($resize-button-width, 2) - 1);
    }

    &::before,
    &::after {
      left: -1 * (math.div($anchor-size, 2) - 1);
    }

    &::before {
      top: -1 * math.div($anchor-size, 2);
    }

    &::after {
      bottom: -1 * math.div($anchor-size, 2);
    }
  }
}

.apos-layout__item-move-handle {
  inset: 0 4px;
  cursor: grab;
}

.apos-layout__item-move-handle-icon {
  position: absolute;
  top: 8px;
  left: 10px;
  width: 30px;
  height: 30px;
  border: 1px solid var(--a-primary-transparent-25);
  background-color: var(--a-white);
  border-radius: var(--a-border-radius);
  box-shadow: var(--a-box-shadow);
}

.apos-layout__item-resize-handle-icon {
  z-index: $resize-ui-z-index;
  pointer-events: none;
  position: absolute;
  top: 0;
  width: $resize-ui-width;
  height: $resize-ui-height;
  opacity: 0;
  border: 1px solid var(--a-primary-transparent-25);
  background-color: var(--a-white);
  border-radius: var(--a-border-radius);
  box-shadow: var(--a-box-shadow);
}

.se .apos-layout__item-resize-handle-icon {
  right: -1 * ($resize-ui-width * 0.64);
}

.nw .apos-layout__item-resize-handle-icon {
  left: -1 * ($resize-ui-width * 0.64);
}

.apos-layout__item-operations-handle {
  top: 0;
  left: 0;
  display: block;
  padding: 8px;
}

.apos-layout__item-operations-handle {
  :deep([data-operation-id="move"] span) {
    cursor: grab;

    &:active {
      cursor: grabbing;
    }
  }
}

/* stylelint-disable-next-line media-feature-name-allowed-list */
@media (prefers-reduced-motion: no-preference) {
  .apos-layout__grid-clone.is-moving {
    transition: transform 200ms ease;
  }
}

</style>
