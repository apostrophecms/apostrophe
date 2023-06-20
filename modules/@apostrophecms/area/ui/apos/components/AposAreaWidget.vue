
<template>
  <div
    class="apos-area-widget-wrapper"
    :class="{'apos-area-widget-wrapper--foreign': foreign}"
    :data-area-widget="widget._id"
    :data-area-label="widgetLabel"
    :data-apos-widget-foreign="foreign ? 1 : 0"
    :data-apos-widget-id="widget._id"
  >
    <div
      class="apos-area-widget-inner"
      :class="ui.container"
      @mouseover="mouseover($event)"
      @mouseleave="mouseleave"
      @click="getFocus($event, widget._id)"
    >
      <div
        class="apos-area-widget-controls apos-area-widget__label"
        :class="ui.labels"
      >
        <ol class="apos-area-widget__breadcrumbs">
          <li class="apos-area-widget__breadcrumb apos-area-widget__breadcrumb--widget-icon">
            <AposIndicator :icon="widgetIcon" :icon-size="13" />
          </li>
          <li
            v-for="(item, index) in breadcrumbs.list"
            :key="item.id"
            class="apos-area-widget__breadcrumb"
            :data-apos-widget-breadcrumb="breadcrumbs.list.length - index"
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
          <li class="apos-area-widget__breadcrumb" data-apos-widget-breadcrumb="0">
            <AposButton
              type="quiet"
              @click="foreign ? $emit('edit', i) : false"
              :label="foreign ? {
                key: 'apostrophe:editWidgetType',
                label: $t(widgetLabel)
              } : widgetLabel"
              tooltip="apostrophe:editWidgetForeignTooltip"
              :icon="foreign ? 'earth-icon' : null"
              :icon-size="11"
              :modifiers="['no-motion']"
            />
          </li>
        </ol>
      </div>
      <div
        class="apos-area-widget-controls apos-area-widget-controls--add apos-area-widget-controls--add--top"
        :class="ui.addTop"
      >
        <AposAreaMenu
          v-if="!foreign"
          :max-reached="maxReached"
          @add="$emit('add', $event);"
          @menu-open="toggleMenuFocus($event, 'top', true)"
          @menu-close="toggleMenuFocus($event, 'top', false)"
          :context-menu-options="contextMenuOptions"
          :index="i"
          :widget-options="widgets"
          :options="options"
          :disabled="disabled"
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
          :foreign="foreign"
          :disabled="disabled"
          :max-reached="maxReached"
          @up="$emit('up', i);"
          @remove="$emit('remove', i);"
          @edit="$emit('edit', i);"
          @cut="$emit('cut', i);"
          @copy="$emit('copy', i);"
          @clone="$emit('clone', i);"
          @down="$emit('down', i);"
        />
      </div>
      <!--
        Note: we will not need this guard layer when we implement widget controls outside of the widget DOM
        because we will be drawing and fitting a new layer ontop of the widget, which we can use to proxy event handling.
      -->
      <div
        class="apos-area-widget-guard"
        :class="{'apos-is-disabled': focused}"
      />
      <!-- Still used for contextual editing components -->
      <component
        v-if="isContextual && !foreign"
        :is="widgetEditorComponent(widget.type)"
        :options="widgetOptions"
        :type="widget.type"
        :value="widget"
        @update="$emit('update', $event)"
        :doc-id="docId"
        :focused="focused"
        :key="generation"
      />
      <component
        v-else
        :is="widgetComponent(widget.type)"
        :options="widgetOptions"
        :type="widget.type"
        :id="widget._id"
        :area-field-id="fieldId"
        :value="widget"
        :foreign="foreign"
        @edit="$emit('edit', i);"
        :doc-id="docId"
        :rendering="rendering"
        :key="generation"
      />
      <div
        class="apos-area-widget-controls apos-area-widget-controls--add apos-area-widget-controls--add--bottom"
        :class="ui.addBottom"
      >
        <AposAreaMenu
          v-if="!foreign"
          :max-reached="maxReached"
          @add="$emit('add', $event)"
          :context-menu-options="bottomContextMenuOptions"
          :index="i + 1"
          :widget-options="widgets"
          :options="options"
          :disabled="disabled"
          @menu-open="toggleMenuFocus($event, 'bottom', true)"
          @menu-close="toggleMenuFocus($event, 'bottom', false)"
        />
      </div>
    </div>
  </div>
</template>

<script>
import { klona } from 'klona';
import AposIndicator from '../../../../ui/ui/apos/components/AposIndicator.vue';

export default {
  name: 'AposAreaWidget',
  components: { AposIndicator },
  props: {
    widgetHovered: {
      type: String,
      default: null
    },
    nonForeignWidgetHovered: {
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
    },
    rendering: {
      type: Object,
      default() {
        return null;
      }
    },
    disabled: {
      type: Boolean,
      default: false
    },
    generation: {
      type: Number,
      required: false,
      default() {
        return null;
      }
    }
  },
  emits: [ 'clone', 'up', 'down', 'remove', 'edit', 'cut', 'copy', 'update', 'add', 'changed' ],
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
        show: 'apos-is-visible',
        open: 'apos-is-open',
        focus: 'apos-is-focused',
        highlight: 'apos-is-highlighted'
      },
      breadcrumbs: {
        $lastEl: null,
        list: []
      },
      widgets: this.options.widgets || {}
    };
  },
  computed: {
    bottomContextMenuOptions() {
      return {
        ...this.contextMenuOptions,
        menuPlacement: 'top'
      };
    },
    widgetIcon() {
      return this.contextMenuOptions.menu.filter(item => item.name === this.widget.type)[0]?.icon || 'shape-icon';
    },
    widgetLabel() {
      const moduleName = `${this.widget.type}-widget`;
      const module = window.apos.modules[moduleName];
      if (!module) {
        console.error(`No ${moduleName} module found for widget type ${this.widget.type}`);
      }
      return module.label;
    },
    widgetOptions() {
      return this.widgets[this.widget.type];
    },
    isContextual() {
      return this.moduleOptions.widgetIsContextual[this.widget.type];
    },
    // Browser options from the `@apostrophecms/area` module.
    moduleOptions() {
      return window.apos.area;
    },
    isSuppressed() {
      if (this.focused) {
        return false;
      }

      if (this.highlightable) {
        return false;
      }

      return !(this.hovered || this.nonForeignHovered);
    },
    hovered() {
      return this.widgetHovered === this.widget._id;
    },
    nonForeignHovered() {
      return this.nonForeignWidgetHovered === this.widget._id;
    },
    // Sets up all the interaction classes based on the current
    // state. If our widget is suppressed, return a blank UI state and reset
    // our real one.
    ui() {
      const state = {
        controls: this.state.controls.show ? this.classes.show : null,
        labels: this.state.labels.show ? this.classes.show : null,
        container: this.state.container.focus ? this.classes.focus
          : ((this.state.container.highlight || this.nonForeignHovered) ? this.classes.highlight : null),
        addTop: this.state.add.top.focus ? this.classes.focus
          : ((this.state.add.top.show || this.nonForeignHovered) ? this.classes.show : null),
        addBottom: this.state.add.bottom.focus ? this.classes.focus
          : ((this.state.add.bottom.show || this.nonForeignHovered) ? this.classes.show : null)
      };

      if (this.isSuppressed) {
        this.resetState();
        return this.blankState;
      }

      return state;
    },
    foreign() {
      // Cast to boolean is necessary to satisfy prop typing
      return !!(this.docId && (window.apos.adminBar.contextId !== this.docId));
    }
  },
  watch: {
    widgetFocused (newVal) {
      if (newVal === this.widget._id) {
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
  created() {
    if (this.options.groups) {
      for (const group of Object.keys(this.options.groups)) {
        this.widgets = {
          ...this.options.groups[group].widgets,
          ...this.widgets
        };
      }
    }
  },
  mounted() {
    // AposAreaEditor is listening for keyboard input that triggers
    // a 'focus my parent' plea
    apos.bus.$on('widget-focus-parent', this.focusParent);

    this.breadcrumbs.$lastEl = this.$el;

    this.getBreadcrumbs();

    if (this.widgetFocused) {
      // If another widget was in focus (because the user clicked the "add"
      // menu, for example), and this widget was created, give the new widget
      // focus.
      apos.bus.$emit('widget-focus', this.widget._id);
    }
  },
  methods: {
    // Focus parent, useful for obtrusive UI
    focusParent() {
      // Something above us asked the focused widget to try and focus its parent
      // We only care about this if we're focused ...
      if (this.focused) {
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
      if (!this.foreign) {
        this.state.add.top.show = true;
        this.state.add.bottom.show = true;
      }
      this.state.container.highlight = true;
      this.state.labels.show = true;
      const closest = this.foreign && this.$el.closest('[data-apos-widget-foreign="0"]');
      const closestId = closest && closest.getAttribute('data-apos-widget-id');
      apos.bus.$emit('widget-hover', {
        _id: this.widget._id,
        nonForeignId: this.foreign ? closestId : null
      });
    },

    mouseleave() {
      if (!this.highlightable) {
        // Force highlight when a parent has been focused
        this.state.container.highlight = false;
      }
      if (!this.focused) {
        this.state.labels.show = false;
        this.state.add.top.show = false;
        this.state.add.bottom.show = false;
      }
      if (this.hovered) {
        apos.bus.$emit('widget-hover', {
          _id: null,
          nonForeignId: null
        });
      }
    },

    focus(e) {
      if (e) {
        e.stopPropagation();
      }
      this.focused = true;
      this.state.container.focus = true;
      this.state.controls.show = true;
      this.state.add.top.show = true;
      this.state.add.bottom.show = true;
      this.state.labels.show = true;
      document.addEventListener('click', this.unfocus);
    },

    unfocus(event) {
      if (!this.$el.contains(event.target)) {
        this.focused = false;
        this.resetState();
        this.highlightable = false;
        document.removeEventListener('click', this.unfocus);
        apos.bus.$emit('widget-focus', null);
      }
    },

    toggleMenuFocus(event, name, value) {
      if (event) {
        event.cancelBubble = true;
      }
      this.state.add[name].focus = value;

      if (value) {
        this.focus();
      }
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
  .apos-area-widget-guard {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
  }

  .apos-area-widget-guard.apos-is-disabled {
    pointer-events: none;
  }

  .apos-area-widget-wrapper {
    position: relative;
  }

  .apos-area-widget-inner {
    position: relative;
    min-height: 50px;
    border-radius: var(--a-border-radius);
    outline: 1px solid transparent;
    transition: outline 0.2s ease;
    &.apos-is-highlighted {
      outline: 1px dashed var(--a-primary-transparent-50);
    }
    &.apos-is-focused {
      outline: 1px dashed var(--a-primary);
      &::v-deep .apos-rich-text-editor__editor.apos-is-visually-empty {
        box-shadow: none;
      }
    }

    .apos-area-widget-inner &:after {
      display: none;
    }
    .apos-area-widget-inner &:before {
      z-index: $z-index-under;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      outline: 1px solid var(--a-base-1);
      outline-offset: -1px;
      background-color: var(--a-base-5);
      pointer-events: none;
    }
    .apos-area-widget-inner &.apos-is-focused:before,
    .apos-area-widget-inner &.apos-is-highlighted:before {
      z-index: $z-index-default;
    }
  }

  .apos-area-widget-inner .apos-area-widget-inner {
    &.apos-is-highlighted:before {
      opacity: 0.1;
    }
    &.apos-is-focused:before {
      opacity: 0.15;
    }
  }

  .apos-area-widget-controls {
    z-index: $z-index-widget-controls;
    position: absolute;
    opacity: 0;
    pointer-events: none;
    transition: all 0.3s ease;

    &.apos-area-widget__label {
      z-index: $z-index-widget-label;
    }
    &.apos-is-focused {
      z-index: $z-index-widget-focused-controls;
    }
  }

  .apos-area-widget-controls--modify {
    right: 0;
    transform: translate3d(-10px, 30px, 0);
    ::v-deep .apos-button-group__inner {
      border: 1px solid var(--a-primary-transparent-25);
      box-shadow: var(--a-box-shadow);
    }
    ::v-deep .apos-button-group .apos-button {
      width: 32px;
      height: 32px;
      padding: 0;
      border: none;
      border-radius: var(--a-border-radius);
      background-color: transparent;
      color: var(--a-base-1);
      &:hover[disabled] {
        background-color: transparent;
      }
      &:hover:not([disabled]), &:active:not([disabled]), &:focus:not([disabled]) {
        background-color: var(--a-primary-transparent-10);
        color: var(--a-primary);
      }
      &[disabled] {
        color: var(--a-base-6);
      }
    }
  }

  .apos-area-widget-controls--add {
    top: 0;
    left: 50%;
    transform: translate(-50%, -50%);
  }

  .apos-area-widget-controls--add ::v-deep {

    .apos-button__wrapper {
      padding: 8px;

      &:hover .apos-button:not([disabled]) {
        transform: scale(1.15);
        background-size: 150% 100%;
        border-radius: 10px;
        transition-duration: 0.5s;

        /* stylelint-disable-next-line max-nesting-depth */
        .apos-button__label {
          max-width: 100px;
          max-height: 100px;
          transition-duration: 0.5s;
          padding: 0 5px 0 0;
        }

        /* stylelint-disable-next-line max-nesting-depth */
        .apos-button__icon {
          margin-right: 5px;
        }
      }
    }

    .apos-button__icon {
      margin-right: 0;
    }

    .apos-button__label {
      display: inline-block;
      overflow: hidden;
      max-width: 0;
      max-height: 0;
      transition: max-width 0.2s var(--a-transition-timing-bounce);
      white-space: nowrap;
      font-size: var(--a-type-small);
    }

    .apos-button {
      display: flex;
      align-items: center;
      justify-content: center;
      background-image: linear-gradient( 45deg, var(--a-primary), var(--a-primary-dark-15), var(--a-primary-light-40), var(--a-primary) );
      background-size: 200% 100%;
      transition: all 0.2s var(--a-transition-timing-bounce);
      padding: 5px;
      border-radius: 12px;
    }
  }

  .apos-area-widget-controls--add--bottom {
    top: auto;
    bottom: 0;
    transform: translate(-50%, 50%);
  }

  .apos-area-widget-inner ::v-deep .apos-context-menu__popup.apos-is-visible {
    top: calc(100% + 20px);
    left: 50%;
    transform: translate(-50%, 0);
  }

  .apos-area-widget__label {
    position: absolute;
    top: -8px;
    right: 0;
    display: flex;
    transform: translateY(-100%);
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
    padding: 4px 6px;
    background-color: var(--a-background-primary);
    border: 1px solid var(--a-primary-transparent-50);
    border-radius: 8px;
  }

  .apos-area-widget-wrapper--foreign .apos-area-widget-inner .apos-area-widget__breadcrumbs {
    background-color: var(--a-background-inverted);
    & ::v-deep .apos-button__content {
      color: var(--a-text-inverted);
    }
  }

  .apos-area-widget__breadcrumb,
  .apos-area-widget__breadcrumb ::v-deep .apos-button__content {
    @include type-help;
    padding: 2px;
    white-space: nowrap;
    color: var(--a-base-1);
    transition: background-color 0.3s var(--a-transition-timing-bounce);
    &:hover {
      cursor: pointer;
    }
  }

  .apos-area-widget__breadcrumbs:hover .apos-area-widget__breadcrumb,
  .apos-area-widget__breadcrumbs:hover .apos-area-widget__breadcrumb ::v-deep .apos-button__content {
    color: var(--a-text-primary);
  }

  .apos-area-widget__breadcrumb--widget-icon {
    padding: 3px 2px 2px;
    background-color: var(--a-primary-transparent-10);
    color: var(--a-primary);
    border-radius: 4px;
    margin-right: 2px;
    transition: background-color 0.3s var(--a-transition-timing-bounce);
  }

  .apos-area-widget__breadcrumbs:hover .apos-area-widget__breadcrumb--widget-icon {
    background-color: var(--a-primary-transparent-25);
  }

  .apos-area-widget__breadcrumb--icon {
    padding: 2px;
    color: var(--a-text-primary);
  }

  .apos-area-widget__breadcrumb ::v-deep .apos-button {
    color: var(--a-primary-dark-10);
    &:hover, &:active, &:focus {
      text-decoration: none;
    }
  }

  .apos-is-visible,
  .apos-is-focused {
    opacity: 1;
    pointer-events: auto;
  }

</style>
