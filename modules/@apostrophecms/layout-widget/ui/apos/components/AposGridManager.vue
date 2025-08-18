<template>
  <!-- FIXME: This component has to be split in pure grid and manager components.
  It's a must have in order to deliver performance when not in manage mode, which
  is 90% of the time. -->
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
          <div class="apos-layout--item-action apos-layout__item-add-handle west">
            <AposButton
              v-bind="buttonDefaults"
              tooltip="Add column before"
              :disabled="validInsertPositions[item._id].west.result === false"
              @click="addItemFit({ item, side: 'west' })"
            />
          </div>
          <div class="apos-layout--item-action apos-layout__item-add-handle east">
            <AposButton
              v-bind="buttonDefaults"
              tooltip="Add column after"
              :disabled="validInsertPositions[item._id].east.result === false"
              @click="addItemFit({ item, side: 'east' })"
            />
          </div>
          <div class="apos-layout--item-action apos-layout__item-delete-handle">
            <AposButton
              v-bind="buttonDefaults"
              icon="delete-icon"
              :modifiers="[ 'round', 'tiny', 'icon-only', 'danger' ]"
              @click="removeItem(item)"
            />
          </div>
          <div class="apos-layout--item-action apos-layout__item-align-actions">
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
        </div>
        <slot
          name="item"
          :item="gridState.originalItems.get(item._id)"
          :i="i"
        />
      </div>
      <div
        v-if="gridState.current.items.length === 0 && meta._id"
        class="apos-layout__item"
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
        <div
          class="apos-layout__item-shim apos-layout__item--add-first"
        >
          <AposButton
            v-bind="addFirstOptions"
            role="button"
            @click="addItemFirst()"
          />
        </div>
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
import {
  itemsToState, canFitX, getReorderPatch
} from '../lib/grid-state.js';
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
      sceneResizeIndex: 0,
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

.apos-layout__item {
  position: relative;
  min-height: 150px;
  opacity: 1;
  transition: all 300ms ease;

  &.is-resizing > .apos-layout__item {
    opacity: 0.2;
  }

  &.is-resizing .apos-layout__item-shim {
    background-color: rgba($brand-blue, 0.8);
  }
}

.apos-layout.manage {
  position: relative;

  & > .apos-layout__item {
    border-radius: var(--a-border-radius);
  }

  & > .apos-layout__item > *{
    pointer-events: none;
  }
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

  &:hover:not(.is-resizing) > .apos-layout--item-action {
    display: block;
  }

  // &.is-resizing {
  //   can be used to style the shim when resizing
  // }

  &.apos-layout__item--add-first {
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px dashed var(--a-brand-blue);
    background-color: transparent;
    border-radius: var(--a-border-radius);
  }
}

.apos-layout--item-action {
  position: absolute;
  display: none;
  border: none;
  background-color: transparent;
  cursor: pointer;
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
