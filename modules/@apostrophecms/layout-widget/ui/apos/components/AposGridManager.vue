<template>
  <section
    :class="gridClasses"
    data-apos-test="aposLayoutContainer"
    :style="{
      '--grid-columns': effectiveOptions.columns,
      '--grid-gap': effectiveOptions.gap,
      '--shim-opacity': itemGhosting ? 0.2 : 0.5
    }"
  >
    <div
      v-for="(item, i) in items"
      :key="item._id"
      ref="items"
      class="apos-layout__item"
      role="gridcell"
      data-apos-test="aposLayoutItem"
      :style="{
        '--colstart': item.desktop.colstart,
        '--colspan': item.desktop.colspan,
        '--rowstart': item.desktop.rowstart,
        '--rowspan': item.desktop.rowspan,
        '--order': item.desktop.order,
        '--justify': item.desktop.justify,
        '--align': item.desktop.align,
        '--item-opacity': itemOpacity
      }"
    >
      <div
        v-if="mode !== 'view'"
        class="apos-layout__item-shim"
      >
        <button
          class="apos-layout__item-resize-handle"
          @mousedown="startResizeHandle(item, $event)"
          @touchstart="startResizeHandle(item, $event)"
          @mouseup="itemGhosting = null"
          @touchend="itemGhosting = null"
        />
      </div>
      <slot
        name="item"
        :item="item"
        :i="i"
      />
    </div>
    <div
      v-if="itemGhosting"
      class="apos-layout__item-ghost"
    />
  </section>
</template>

<script>
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
     * The mode of the grid manager, which can be 'manage', 'manage-focus', 'view'
     */
    mode: {
      type: String,
      default: 'manage'
    }
  },
  data() {
    return {
      // `null` or object with properties for ghosting the resize handle:
      // { left, top, width, height }
      itemGhosting: null
    };
  },
  computed: {
    gridClasses() {
      return {
        'apos-layout': true,
        manage: [ 'manage', 'manage-focus' ].includes(this.mode),
        focused: this.mode === 'manage-focus'
      };
    },
    effectiveOptions() {
      return {
        ...this.options,
        columns: this.meta.columns || this.options.columns,
        gap: this.mode !== 'view' ? '3px' : this.options.gap || '0'
      };
    },
    itemOpacity() {
      return this.itemGhosting ? 0.2 : 1;
    }
  },
  methods: {
    // FIXME: start the calcualtions.
    startResizeHandle(item, event) {
      // Logic to handle the start of resizing an item
      // This could include setting the ghosting state
      this.itemGhosting = {
        left: event.clientX,
        top: event.clientY,
        width: item.desktop.colspan * 100, // Example calculation
        height: item.desktop.rowspan * 100 // Example calculation
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

.apos-layout__item {
  opacity: 1;
}

/* Management specific features, enhancing the grid/items
to deliver management features */
.apos-layout.manage {
  position: relative;
}

.apos-layout.manage > .apos-layout__item {
  position: relative;
  border-radius: var(--a-border-radius);
}

.apos-layout.manage > .apos-layout__item > *{
  pointer-events: none;
}

// Set the z-index to SCSS var $z-index-widget-focused-controls + 1
.apos-layout__item-shim {
  z-index: $z-index-widget-label;
  position: absolute;
  inset: 0;
  /* stylelint-disable-next-line declaration-no-important */
  pointer-events: all !important;
  opacity: var(--shim-opacity);
  border-radius: var(--a-border-radius);
  background-color: transparent;
  transition: background-color 400ms ease;

  &:hover {
    background-color: var(--a-brand-blue);
  }

  &:hover > button {
    display: block;
  }
}

.apos-layout__item-resize-handle {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  display: none;
  width: 8px;
  background-color: transparent;
  border: none;
  cursor: col-resize;

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
}

.apos-layout__item-ghost {
  z-index: $z-index-manager-toolbar;
  position: absolute;
  width: 500px;
  height: 150px;
  border: 2px dashed rgba($brand-blue, 0.4);
  inset: 0;
  background-color: rgba($brand-blue, 0.3);
  border-radius: var(--a-border-radius);
  pointer-events: none;
}

/* stylelint-disable-next-line media-feature-name-allowed-list */
@media (prefers-reduced-motion: no-preference) {
  .apos-layout {
    transition: all 300ms ease;
  }
}

</style>
