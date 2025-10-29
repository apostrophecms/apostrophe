<template>
  <div
    ref="root"
    class="apos-layout"
    :class="{'apos-layout--max-width': isManageMode }"
    :style="rootCssVars"
  >
    <TransitionGroup
      ref="grid"
      name="apos-grid"
      tag="section"
      class="apos-layout__grid"
      :class="gridClasses"
      data-apos-test="aposLayoutContainer"
      data-tablet-auto="true"
      data-mobile-auto="true"
      :style="{
        '--grid-columns': gridState.columns,
        '--grid-gap': gridState.options.gap || '0',
        '--grid-rows': 'auto',
        '--mobile-grid-rows': 'auto',
        '--tablet-grid-rows': 'auto',
        '--justify-items': gridState.options.defaultCellHorizontalAlignment || 'stretch',
        '--align-items': gridState.options.defaultCellVerticalAlignment || 'stretch',
      }"
    >
      <div
        v-for="(item, i) in renderItems"
        :key="item._id"
        ref="contentItems"
        class="apos-layout__item"
        role="gridcell"
        data-apos-test="aposLayoutItem"
        :data-tablet-full="tabletFullItems[item._id] || false"
        :data-visible-tablet="item.tablet?.show"
        :data-visible-mobile="item.mobile?.show"
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
              :class="[{'apos-layout__item-synthetic--toosmall': item.toosmall}]"
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
      :preview="preview"
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
    'resize-start',
    'resize-end',
    'move-start',
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
    rootCssVars() {
      // Escape quotes and backslashes for CSS content property
      const text = this.$t('apostrophe:layoutColumnEmptyArea')
        .replace(/\\/g, '\\\\')
        .replace(/'/g, '\\\'');
      return {
        '--empty-area-text': `'${text}'`
      };
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
      if (
        this.isManageMode &&
        Array.isArray(this.preview.patches) &&
        this.preview.patches.length
      ) {
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
    tabletFullItems() {
      if (this.isManageMode) {
        return {};
      }
      const items = this.gridState.current.items
        .filter(widget => widget.tablet.show);
      if (items.length % 2 === 0) {
        return {};
      }
      items.sort((a, b) =>
        (a.tablet.order ?? a.order) - (b.tablet.order ?? b.order)
      );
      const lastId = items[items.length - 1]._id;
      return {
        [lastId]: true
      };
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
      this.$emit('resize-start');
    },
    onResizeEnd(event) {
      this.isResizing = false;
      this.$emit('resize-end', event);
    },
    onMoveStart() {
      this.isMoving = true;
      this.$emit('move-start');
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

<style lang="scss">
/* This style block is deliberately unscoped so that our generated container queries
  have the needed specificity to override it when previewing responsive breakpoints */

/* The base grid styles, mimicking the default public behavior */
.apos-layout__grid {
  display: grid;
  grid-template-columns: repeat(var(--grid-columns, 12), 1fr);
  grid-template-rows: repeat(var(--grid-rows), auto);
  grid-gap: var(--grid-gap, 0);
  justify-items: var(--justify-items);
  /* stylelint-disable-next-line declaration-block-no-redundant-longhand-properties */
  align-items: var(--align-items);
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

  &--max-width {
    right: auto;
    left: auto;
    max-width: calc(100vw - 40px);
    box-sizing: border-box;
    margin-right: auto;
    margin-left: auto;
  }

  &__grid.manage :deep(.apos-area),
  &__grid.manage :deep(.apos-empty-area) {
    padding-top: 0;
    padding-bottom: 0;
  }

  &__grid.manage :deep(.apos-layout__item-content),
  &__grid.manage :deep(.apos-area-widget-wrapper),
  &__grid.manage :deep(.apos-area-widget-inner),
  &__grid.manage :deep(.apos-area-widget-inner > div),
  &__grid.manage :deep(.apos-area),
  &__grid.manage :deep(.apos-empty-area) {
    height: 100%;
  }

  &__grid.manage :deep(.apos-empty-area::before) {
    position: absolute;
    font-family: var(--a-family-default);
    text-align: center;
    content: var(--empty-area-text);
  }

  &__grid.manage :deep(.apos-area-menu .apos-button) {
    display: none;
  }

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
