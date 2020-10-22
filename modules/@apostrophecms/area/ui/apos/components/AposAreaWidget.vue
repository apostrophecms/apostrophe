
<template>
  <div
    class="apos-area-widget-wrapper" :data-area-widget="widgetId"
    :data-area-label="widgetLabel"
  >
    <div
      class="apos-area-widget-inner"
      :class="ui.container"
      @mouseover="mouseover($event)"
      @mouseleave="mouseleave"
      @click="getFocus($event, widgetId)"
    >
      <div
        class="apos-area-widget-controls apos-area-widget__label"
        :class="ui.labels"
      >
        <ol class="apos-area-widget__breadcrumbs">
          <li
            v-for="item in breadcrumbs.list"
            :key="item.id"
            class="apos-area-widget__breadcrumb"
          >
            <AposButton
              type="quiet"
              @click="getFocus($event, item.id)"
              :label="item.label"
              icon="chevron-right-icon"
              :icon-size="9"
              :modifiers="['icon-right', 'no-motion']"
            />
          </li>
          <li class="apos-area-widget__breadcrumb">
            {{ widgetLabel }}
          </li>
        </ol>
      </div>
      <div
        class="apos-area-widget-controls apos-area-widget-controls--add apos-area-widget-controls--add--top"
        :class="ui.addTop"
      >
        <AposAreaMenu
          :max-reached="maxReached"
          @insert="$emit('insert', $event);"
          @menu-open="toggleMenuFocus($event, 'top', true)"
          @menu-close="toggleMenuFocus($event, 'top', false)"
          :context-menu-options="contextMenuOptions"
          :index="i"
          :widget-options="options.widgets"
        />
      </div>
      <div
        class="apos-area-widget-controls apos-area-widget-controls--modify"
        :class="ui.controls"
      >
        <AposWidgetControls
          :first="i === 0"
          :last="i === next.length - 1"
          :options="{ contextual: isContextual }"
          @up="$emit('up', i);"
          @remove="$emit('remove', i);"
          @edit="$emit('edit', i);"
          @clone="$emit('clone', i);"
          @down="$emit('down', i);"
        />
      </div>
      <!-- Still used for contextual editing components -->
      <component
        v-if="editing"
        :is="widgetEditorComponent(widget.type)"
        :value="widget"
        @update="$emit('update', $event)"
        :options="options.widgets[widget.type]"
        :type="widget.type"
        :doc-id="docId"
        data-apos-widget
      />
      <component
        v-if="(!editing) || (!isContextual)"
        :is="widgetComponent(widget.type)"
        :options="options.widgets[widget.type]"
        :type="widget.type"
        :id="widget._id"
        :area-field-id="fieldId"
        :value="widget"
        @edit="$emit('edit', i);"
        :doc-id="docId"
        data-apos-widget
      />
      <div
        class="apos-area-widget-controls apos-area-widget-controls--add apos-area-widget-controls--add--bottom"
        :class="ui.addBottom"
      >
        <AposAreaMenu
          :max-reached="maxReached"
          @insert="$emit('insert', $event)"
          :context-menu-options="bottomContextMenuOptions"
          :index="i + 1"
          :widget-options="options.widgets"
          @menu-open="toggleMenuFocus($event, 'bottom', true)"
          @menu-close="toggleMenuFocus($event, 'bottom', false)"
        />
      </div>
    </div>
  </div>
</template>

<script>

import cuid from 'cuid';
import klona from 'klona';

export default {
  name: 'AposAreaWidget',
  props: {
    // For contextual editing
    editing: {
      type: Boolean,
      default: false
    },
    widgetHovered: {
      type: String,
      default: null
    },
    widgetFocused: {
      type: String,
      default: null
    },
    docId: {
      type: String,
      required: false,
      default() {
        return null;
      }
    },
    i: {
      type: Number,
      required: true
    },
    options: {
      type: Object,
      default() {
        return {};
      }
    },
    widget: {
      type: Object,
      default() {
        return {};
      }
    },
    next: {
      type: Array,
      required: true
    },
    fieldId: {
      type: String,
      required: true
    },
    contextMenuOptions: {
      type: Object,
      required: true
    },
    maxReached: {
      type: Boolean
    }
  },
  emits: [ 'clone', 'up', 'down', 'remove', 'edit', 'update', 'insert', 'changed' ],
  data() {
    const initialState = {
      controls: {
        show: false
      },
      container: {
        highlight: false,
        focus: false
      },
      add: {
        bottom: {
          show: false,
          focus: false
        },
        top: {
          show: false,
          focus: false
        }
      },
      labels: {
        show: false
      }
    };
    return {
      blankState: klona(initialState),
      state: klona(initialState),
      highlightable: false,
      focused: false,
      classes: {
        show: 'apos-show',
        open: 'apos-open',
        focus: 'apos-focus',
        highlight: 'apos-highlight'
      },
      breadcrumbs: {
        $lastEl: null,
        list: []
      }
    };
  },
  computed: {
    bottomContextMenuOptions() {
      return {
        ...this.contextMenuOptions,
        menuPlacement: 'top'
      };
    },
    widgetLabel() {
      return window.apos.modules[`${this.widget.type}-widget`].label;
    },
    isContextual() {
      return this.moduleOptions.widgetIsContextual[this.widget.type];
    },
    // Browser options from the `@apostrophecms/area` module.
    moduleOptions() {
      return window.apos.area;
    },
    widgetId() {
      return cuid();
    },
    isSuppressed() {
      if (this.widgetFocused === this.widgetId) {
        return false;
      }

      if (this.highlightable) {
        return false;
      }

      if (this.widgetHovered) {
        return this.widgetHovered !== this.widgetId;
      } else {
        return false;
      }
    },
    // Sets up all the interaction classes based on the current
    // state. If our widget is suppressed, return a blank UI state and reset
    // our real one.
    ui() {
      const state = {
        controls: this.state.controls.show ? this.classes.show : null,
        labels: this.state.labels.show ? this.classes.show : null,
        container: this.state.container.focus ? this.classes.focus
          : (this.state.container.highlight ? this.classes.highlight : null),
        addTop: this.state.add.top.focus ? this.classes.focus
          : (this.state.add.top.show ? this.classes.show : null),
        addBottom: this.state.add.bottom.focus ? this.classes.focus
          : (this.state.add.bottom.show ? this.classes.show : null)
      };

      if (this.isSuppressed) {
        this.resetState();
        return this.blankState;
      }

      return state;
    }
  },
  watch: {
    widgetFocused (newVal) {
      if (newVal === this.widgetId) {
        this.focus();
      } else {
        // reset everything
        this.resetState();
        this.focused = false;
      }
      const $parent = this.getParent();
      if (
        $parent &&
        $parent.dataset.areaWidget === newVal
      ) {
        // Our parent was focused
        this.resetState();
        this.state.container.highlight = true;
        this.highlightable = true;
      } else {
        this.highlightable = false;
      }
    }
  },
  mounted() {
    // AposAreaEditor is listening for keyboard input that triggers
    // a 'focus my parent' plea
    apos.bus.$on('widget-focus-parent', this.focusParent);

    this.breadcrumbs.$lastEl = this.$el;
    this.getBreadcrumbs();
  },
  methods: {

    // Focus parent, useful for obtrusive UI
    focusParent() {
      // Something above us asked the focused widget to try and focus its parent
      // We only care about this if we're focused ...
      if (this.widgetFocused === this.widgetId) {
        const $parent = this.getParent();
        // .. And have a parent
        if ($parent) {
          apos.bus.$emit('widget-focus', $parent.dataset.areaWidget);
        }
      }
    },

    // Ask the parent AposAreaEditor to make us focused
    getFocus(e, id) {
      e.stopPropagation();
      apos.bus.$emit('widget-focus', id);
    },

    // Our widget was hovered
    mouseover(e) {
      if (e) {
        e.stopPropagation();
      }
      if (this.focused) {
        return;
      }
      this.state.add.top.show = true;
      this.state.add.bottom.show = true;
      this.state.container.highlight = true;
      this.state.labels.show = true;
      apos.bus.$emit('widget-hover', this.widgetId);
    },

    mouseleave() {
      if (!this.highlightable) {
        // Force highlight when a parent has been focused
        this.state.container.highlight = false;
      }
      if (!this.focused) {
        this.state.labels.show = false;
      }
      this.state.add.top.show = false;
      this.state.add.bottom.show = false;
    },

    focus(e) {
      if (e) {
        e.stopPropagation();
      }
      this.focused = true;
      this.state.container.focus = true;
      this.state.controls.show = true;
      this.state.add.top.show = false;
      this.state.add.bottom.show = false;
      this.state.labels.show = true;
      document.addEventListener('click', this.unfocus);
    },

    unfocus(event) {
      if (!this.$el.contains(event.target)) {
        this.focused = false;
        this.resetState();
        this.highlightable = false;
        document.removeEventListener('click', this.blurUnfocus);
        apos.bus.$emit('widget-focus', null);
      }
    },

    toggleMenuFocus(event, name, value) {
      if (event) {
        event.cancelBubble = true;
      }
      this.state.add[name].focus = value;
    },

    resetState() {
      this.state = klona(this.blankState);
    },

    getParent() {
      return apos.util.closest(this.$el.parentNode, '[data-area-widget]');
    },

    // Hacky way to get the parents tree of a widget
    // would be easier of areas/widgets were recursively calling each other and able to pass data all the way down
    getBreadcrumbs() {
      if (this.breadcrumbs.$lastEl) {
        const $parent = apos.util.closest(this.breadcrumbs.$lastEl.parentNode, '[data-area-widget]');
        if ($parent) {
          this.breadcrumbs.list.unshift({
            id: $parent.dataset.areaWidget,
            label: $parent.dataset.areaLabel
          });
          this.breadcrumbs.$lastEl = $parent;
          this.getBreadcrumbs();
        } else {
          this.breadcrumbs.$lastEl = null; // end
        }
      }
    },

    widgetComponent(type) {
      return this.moduleOptions.components.widgets[type];
    },
    widgetEditorComponent(type) {
      return this.moduleOptions.components.widgetEditors[type];
    }
  }
};
</script>

<style lang="scss" scoped>
  .apos-area-widget-wrapper {
    position: relative;
  }

  .apos-area-widget-inner {
    position: relative;
    min-height: 50px;
    &:before, &:after {
      content: '';
      position: absolute;
      left: 0;
      width: 100%;
      height: 1px;
      border-top: 1px dashed var(--a-primary);
      opacity: 0;
      transition: opacity 0.2s ease;
      pointer-events: none;
    }
    &:before {
      top: 0;
    }
    &:after {
      bottom: 0;
    }
    &.apos-highlight {
      z-index: $z-index-widget-highlight;
      &:before, &:after {
        opacity: 0.4;
      }
    }
    &.apos-focus {
      z-index: $z-index-widget-focus;
      &:before, &:after {
        opacity: 1;
        border-top: 1px solid var(--a-primary);
      }
    }
  }

  .apos-area-widget-inner .apos-area-widget-inner:after {
    display: none;
  }
  .apos-area-widget-inner .apos-area-widget-inner:before {
    z-index: $z-index-under;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    outline: 1px solid var(--a-base-1);
    outline-offset: -1px;
    background-color: var(--a-base-5);
  }
  .apos-area-widget-inner .apos-area-widget-inner {
    &.apos-highlight:before {
      opacity: 0.1;
    }
    &.apos-focus:before {
      opacity: 0.15;
    }
  }

  .apos-area-widget-inner .apos-area-widget-inner {
    &.apos-highlight, &.apos-focus {
      outline-color: var(--a-secondary);
    }
  }

  .apos-area-widget-controls {
    z-index: $z-index-default;
    position: absolute;
    opacity: 0;
    pointer-events: none;
    transition: all 0.3s ease;
  }

  .apos-area-widget-controls--modify {
    right: 0;
    transform: translate3d(calc(100% + 5px), 0, 0);
    @media (max-width: ($a-canvas-max + 100px)) { // include extra space for tools
      transform: translate3d(-10px, 30px, 0);
    }
  }

  .apos-area-widget-inner .apos-area-widget-inner .apos-area-widget-controls--modify {
    right: auto;
    left: 0;
    transform: translate3d(calc(-100% - 5px), 0, 0);
    @media (max-width: ($a-canvas-max + 100px)) { // include extra space for tools
      transform: translate3d(5px, 30px, 0);
    }
  }

  .apos-area-widget-controls--add {
    top: 0;
    left: 50%;
    transform: translateY(-50%);
    &.apos-focus {
      z-index: $z-index-widget-add-focus;
    }
  }

  .apos-area-widget-controls--add--bottom {
    top: auto;
    bottom: 0;
    transform: translateY(50%);
  }

  .apos-area-widget-inner /deep/ .apos-context-menu__popup.is-visible {
    top: calc(100% + 20px);
    left: 50%;
    transform: translate(-50%, 0);
  }

  .apos-area-widget-inner .apos-area-widget-inner /deep/ .apos-context-menu__btn {
    background-color: var(--a-secondary);
    border-color: var(--a-secondary);
  }

  .apos-area-widget__label {
    position: absolute;
    display: flex;
  }

  .apos-area-widget__label {
    right: 0;
  }

  .apos-area-widget-inner .apos-area-widget-inner .apos-area-widget__label {
    right: auto;
    left: 0;
  }

  .apos-area-widget__breadcrumbs {
    @include apos-list-reset();
    display: flex;
    align-items: center;
    margin: 0;
    padding: 2px;
    background-color: var(--a-primary);
  }

  .apos-area-widget-inner .apos-area-widget-inner .apos-area-widget__breadcrumbs {
    background-color: var(--a-secondary);
  }

  .apos-area-widget__breadcrumb,
  .apos-area-widget__breadcrumb /deep/ .apos-button__content {
    padding: 2px;
    color: var(--a-white);
    font-weight: normal;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    font-size: map-get($font-sizes, meta);
    &:hover {
      cursor: pointer;
    }
  }

  .apos-area-widget__breadcrumb /deep/ .apos-button {
    &:hover, &:active, &:focus {
      text-decoration: none;
    }
  }

  .apos-area-widget-inner .apos-area-widget-inner .apos-area-widget__type {
    background-color: var(--a-secondary);
  }

  .apos-show,
  .apos-focus {
    opacity: 1;
    pointer-events: auto;
  }

</style>
