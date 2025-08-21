<template>
  <!-- FIXME: This component has to be split in pure grid and manager components.
  It's a must have in order to deliver performance when not in manage mode, which
  is 90% of the time. -->
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
        v-for="(item, i) in gridState.current.items"
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
          <slot
            name="item"
            :item="gridState.originalItems.get(item._id)"
            :i="i"
          />
        </div>
      </div>
    </section>
    <section
      v-show="isManageMode"
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
            class="apos-layout--item-action apos-layout__item-resize-handle west"
            @mousedown="onStartXResize(item, 'west', $event)"
            @touchstart="onStartXResize(item, 'west', $event)"
            @mouseup="resetGhostData"
            @touchend="resetGhostData"
          />
          <button
            class="apos-layout--item-action apos-layout__item-resize-handle east"
            @mousedown="onStartXResize(item, 'east', $event)"
            @touchstart="onStartXResize(item, 'east', $event)"
            @mouseup="resetGhostData"
            @touchend="resetGhostData"
          />
          <div
            v-show="!hasMotion"
            class="apos-layout--item-action apos-layout__item-add-handle west"
          >
            <AposButton
              v-bind="buttonDefaults"
              tooltip="Add column before"
              :disabled="validInsertPositions[item._id].west.result === false"
              @click="addItemFit({ item, side: 'west' })"
            />
          </div>
          <div
            v-show="!hasMotion"
            class="apos-layout--item-action apos-layout__item-add-handle east"
          >
            <AposButton
              v-bind="buttonDefaults"
              tooltip="Add column after"
              :disabled="validInsertPositions[item._id].east.result === false"
              @click="addItemFit({ item, side: 'east' })"
            />
          </div>
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
          <div
            v-show="!hasMotion"
            class="apos-layout--item-action apos-layout__item-align-actions"
          >
            <div class="apos-layout__item-align-actions--row">
              <AposButton
                v-bind="buttonDefaults"
                :tooltip="$t('apostrophe:layoutLeft')"
                icon="alignh-left-icon"
                :modifiers="[ 'tiny', 'icon-only' ]"
                @click="patchItem(item, { justify: 'start' })"
              />
              <AposButton
                v-bind="buttonDefaults"
                :tooltip="$t('apostrophe:layoutCenter')"
                icon="alignh-center-icon"
                :modifiers="[ 'tiny', 'icon-only' ]"
                @click="patchItem(item, { justify: 'center' })"
              />
              <AposButton
                v-bind="buttonDefaults"
                :tooltip="$t('apostrophe:layoutRight')"
                icon="alignh-right-icon"
                :modifiers="[ 'tiny', 'icon-only' ]"
                @click="patchItem(item, { justify: 'end' })"
              />
              <AposButton
                v-bind="buttonDefaults"
                :tooltip="$t('apostrophe:layoutStretchHorizontal')"
                icon="alignh-stretch-icon"
                :modifiers="[ 'tiny', 'icon-only' ]"
                @click="patchItem(item, { justify: 'stretch' })"
              />
            </div>
            <div class="apos-layout__item-align-actions--row">
              <AposButton
                v-bind="buttonDefaults"
                :tooltip="$t('apostrophe:layoutTop')"
                icon="alignv-top-icon"
                :modifiers="[ 'tiny', 'icon-only' ]"
                @click="patchItem(item, { align: 'start' })"
              />
              <AposButton
                v-bind="buttonDefaults"
                :tooltip="$t('apostrophe:layoutMiddle')"
                icon="alignv-center-icon"
                :modifiers="[ 'tiny', 'icon-only' ]"
                @click="patchItem(item, { align: 'center' })"
              />
              <AposButton
                v-bind="buttonDefaults"
                :tooltip="$t('apostrophe:layoutBottom')"
                icon="alignv-bottom-icon"
                :modifiers="[ 'tiny', 'icon-only' ]"
                @click="patchItem(item, { align: 'end' })"
              />
              <AposButton
                v-bind="buttonDefaults"
                :tooltip="$t('apostrophe:layoutStretchVertical')"
                icon="alignh-stretch-icon"
                :modifiers="[ 'tiny', 'icon-only' ]"
                @click="patchItem(item, { align: 'stretch' })"
              />
            </div>
            <div class="apos-layout__item-align-actions--row">
              <AposButton
                v-bind="buttonDefaults"
                :tooltip="$t('apostrophe:layoutTabletShow')"
                icon="tablet-icon"
                :style="{ opacity: item.tablet.show ? 1 : 0.6 }"
                :modifiers="[ 'tiny', 'icon-only' ]"
                @click="toggleDeviceVisibility(item, 'tablet')"
              />
              <AposButton
                v-bind="buttonDefaults"
                :tooltip="$t('apostrophe:layoutMobileShow')"
                icon="cellphone-icon"
                :style="{ opacity: item.mobile.show ? 1 : 0.6 }"
                :modifiers="[ 'tiny', 'icon-only' ]"
                @click="toggleDeviceVisibility(item, 'mobile')"
              />
            </div>
          </div>
          <button
            v-show="!hasMotion"
            class="apos-layout--item-action apos-layout__item-move-handle"
            @mousedown="onStartMove(item, $event)"
            @touchstart="onStartMove(item, $event)"
            @mouseup="resetGhostData"
            @touchend="resetGhostData"
          />
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
      <div
        v-if="isManageMode && gridState.current.items.length === 0 && meta._id"
        class="apos-layout__item apos-layout__item-synthetic"
        :style="{
          '--colstart': 1,
          '--colspan': gridState.options.defaultSpan,
          '--rowstart': 1,
          '--rowspan': 1,
          '--order': 0,
          '--justify': 'stretch',
          '--align': 'stretch',
        }"
      >
        <AposButton
          v-bind="addFirstOptions"
          role="button"
          @click="addItemFirst()"
        />
      </div>
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
        v-if="hasMotion && ghostData.snapLeft"
        :style="{
          left: ghostData.snapLeft + 'px',
          top: ghostData.snapTop + 'px',
          width: ghostData.width + 'px',
          height: ghostData.height + 'px'
        }"
        class="apos-layout__item-ghost snap"
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
import {
  itemsToState, canFitX, getReorderPatch,
  prepareMoveIndex
} from '../lib/grid-state.mjs';

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
  emits: [
    'resize-end',
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
        order: null,
        snapColstart: null,
        snapRowstart: null
      },
      moveDataIndex: null,
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
      }
      // gridContentStyles: new Map()
    };
  },
  computed: {
    gridClasses() {
      return {
        manage: this.isManageMode,
        focused: this.isFocusedMode,
        'is-resizing': this.isResizing
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
    isMoving() {
      return this.ghostData.isMoving;
    },
    hasMotion() {
      return this.isResizing || this.isMoving;
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
      if (!this.isManageMode || this.cloneCalculateIndex === 0) {
        return new Map();
      }
      return this.manager.getGridContentStyles(
        this.$refs.contentItems
      );
    },
    validInsertPositions() {
      return this.gridState.current.items.reduce((acc, item) => {
        acc[item._id] = {
          _id: item._id,
          east: canFitX({
            item,
            side: 'east',
            state: this.gridState
          }),
          west: canFitX({
            item,
            side: 'west',
            state: this.gridState
          })
        };
        return acc;
      }, {});
    }
  },
  async mounted() {
    document.addEventListener('keydown', this.onGlobalKeyDown);
    document.addEventListener('mouseup', this.onMouseUp);
    document.addEventListener('touchend', this.onMouseUp);

    this.manager.init(
      this.$refs.root,
      this.$refs.grid,
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
    this.resizeObserver.observe(this.$refs.grid);

    await this.$nextTick();
    this.cloneCalculateIndex += 1;
    this.sceneResizeIndex += 1;
  },
  unmounted() {
    document.removeEventListener('keydown', this.onGlobalKeyDown);
    document.removeEventListener('mouseup', this.onMouseUp);
    document.removeEventListener('touchend', this.onMouseUp);
    document.removeEventListener('scroll', this.manager.onSceneResizeDebounced);
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    this.manager.destroy();
  },
  methods: {
    onStartXResize(item, side, event) {
      event.preventDefault();
      event.stopPropagation();
      const element = this.$refs.items.find(el => el.dataset.id === item._id);
      const itemData = this.gridState.lookup.get(item._id);
      if (!itemData || !element) {
        return;
      }
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

      this.moveDataIndex = prepareMoveIndex({
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
        left, top, snapLeft, snapTop, colstart, rowstart, snapColstart, snapRowstart
      } = this.manager.onGhostMove(
        {
          state: this.gridState,
          data: this.ghostData,
          item: this.gridState.lookup.get(this.ghostData.id)
        },
        event
      );
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
      if (snapColstart && snapRowstart) {
        this.ghostDataWrite.snapColstart = snapColstart;
        this.ghostDataWrite.snapRowstart = snapRowstart;
      }
    },
    onMouseMove(event) {
      if (this.isResizing) {
        this.onResize(event);
      } else if (this.isMoving) {
        this.onMove(event);
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
      const patches = this.manager.performItemMove(
        {
          data: this.ghostDataWrite,
          state: this.gridState,
          item: this.gridState.lookup.get(this.ghostDataWrite.id),
          index: this.moveDataIndex
        }
      );
      console.log('Patches from move:', patches);
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
    addItemFit({ item, side }) {
      const fit = this.validInsertPositions[item._id]?.[side];
      if (!fit?.result) {
        return;
      }
      const newItem = {
        colstart: fit.colstart,
        colspan: fit.colspan,
        rowstart: item.rowstart ?? 1,
        rowspan: 1
      };
      const patches = getReorderPatch({
        item: newItem,
        state: this.gridState
      });
      this.$emit('add-fit-item', patches);
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

/*
  Management specific features, enhancing the grid/items
  to deliver management features
*/
.apos-layout {
  position: relative;

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

  &__grid.manage > &__item-content > *{
    pointer-events: none;
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
    border: 1px dashed rgba($brand-blue, 0.8);
    transition: background-color 300ms ease;
    inset: 0;
    /* stylelint-disable-next-line declaration-no-important */
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
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    border: 1px dashed var(--a-brand-blue);
    background-color: transparent;
    border-radius: var(--a-border-radius);
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
    // border: 1px dashed rgba($brand-blue, 0.4);
    inset: 0;
    background-color: rgba($brand-blue, 0.2);
    border-radius: var(--a-border-radius);
    pointer-events: none;
    /* stylelint-disable-next-line time-min-milliseconds */
    transition: all 100ms ease-out;

    &.snap {
      border: 2px dashed rgba($brand-blue, 0.8);
      background-color: transparent; //rgba($brand-blue, 0.6);
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
  top: 0;
  bottom: 0;
  width: 8px;

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
    max-width: 1px;
    max-height: 15px;
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

.apos-layout__item-move-handle {
  inset: 70px 15px 0;
  cursor: move;
}

.apos-layout__item-add-handle {
  top: 0;
  padding: 8px;

  &.east {
    right: 0;
  }

  &.west {
    // top: 50%;
    left: 0;
    // transform: translateY(-50%);
  }
}

.apos-layout__item-delete-handle {
  top: 0;
  right: 22px;
  padding: 8px;
}

.apos-layout__item-align-actions {
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  display: none;
  padding: 8px;

  &--row {
    display: flex;
    flex-direction: row;
    justify-content: center;
    gap: 4px;
  }
}

/* stylelint-disable-next-line media-feature-name-allowed-list */
@media (prefers-reduced-motion: no-preference) {
  .apos-layout {
    transition: all 300ms ease;
  }
}

</style>
