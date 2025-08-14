<template>
  <div
    ref="widget"
    class="apos-area-widget-wrapper"
    :class="{'apos-area-widget-wrapper--foreign': foreign}"
    :data-area-widget="widget._id"
    :data-area-label="widgetLabel"
    :data-apos-widget-foreign="foreign ? 1 : 0"
    :data-apos-widget-id="widget._id"
    tabindex="0"
  >
    <div
      ref="wrapper"
      class="apos-area-widget-inner"
      :class="containerClasses"
      tabindex="0"
      @mouseover="mouseover($event)"
      @mouseleave="mouseleave"
      @click="getFocus($event, widget._id);"
      @focus="attachKeyboardFocusHandler"
      @blur="removeKeyboardFocusHandler"
    >
      <div
        ref="label"
        class="apos-area-widget-controls apos-area-widget__label"
        :class="labelsClasses"
      >
        <ol
          class="apos-area-widget__breadcrumbs"
          @click="isSuppressingWidgetControls = false"
        >
          <li
            class="
              apos-area-widget__breadcrumb
              apos-area-widget__breadcrumb--widget-icon
            "
          >
            <AposIndicator
              :icon="widgetIcon"
              :icon-size="13"
            />
          </li>
          <li
            v-for="(item, index) in breadcrumbs.list"
            :key="item.id"
            class="apos-area-widget__breadcrumb"
            :data-apos-widget-breadcrumb="breadcrumbs.list.length - index"
          >
            <AposButton
              type="quiet"
              :label="item.label"
              icon="chevron-right-icon"
              :icon-size="9"
              :modifiers="['icon-right', 'no-motion']"
              :disable-focus="!(isHovered || isFocused)"
              @click="getFocus($event, item.id)"
            />
          </li>
          <li
            class="apos-area-widget__breadcrumb"
            data-apos-widget-breadcrumb="0"
          >
            <AposButton
              type="quiet"
              :label="foreign ? {
                key: 'apostrophe:editWidgetType',
                label: $t(widgetLabel)
              } : widgetLabel"
              :tooltip="!isContextual && 'apostrophe:editWidgetForeignTooltip'"
              :icon-size="11"
              :modifiers="['no-motion']"
              :disable-focus="!(isHovered || isFocused)"
              @click="foreign ? $emit('edit', i) : null"
              @dblclick="(!foreign && !isContextual) ? $emit('edit', i) : null"
            />
          </li>
        </ol>
      </div>
      <div
        class="
          apos-area-widget-controls
          apos-area-widget-controls--add--top
          apos-area-widget-controls--add
        "
        :class="addClasses"
      >
        <AposAreaMenu
          v-if="!foreign"
          :max-reached="maxReached"
          :context-menu-options="contextMenuOptions"
          :index="i"
          :widget-options="widgets"
          :options="options"
          :field-id="fieldId"
          :disabled="disabled"
          :tabbable="isHovered || isFocused"
          :menu-id="`${widget._id}-widget-menu-top`"
          :class="{[classes.open]: menuOpen === 'top'}"
          :open="menuOpen === 'top'"
          @add="$emit('add', $event);"
        />
      </div>
      <div
        class="apos-area-widget-guard"
        :class="{'apos-is-disabled': isFocused}"
      />
      <div
        class="apos-area-widget-controls apos-area-widget-controls--modify"
        :class="controlsClasses"
      >
        <AposWidgetControls
          v-if="!foreign"
          :first="i === 0"
          :last="i === next.length - 1"
          :options="{ contextual: isContextual }"
          :disabled="disabled"
          :max-reached="maxReached"
          :tabbable="isFocused"
          :model-value="widget"
          :widget-options="widgetOptions"
          @up="$emit('up', i);"
          @remove="$emit('remove', i);"
          @edit="$emit('edit', i);"
          @cut="$emit('cut', i);"
          @copy="$emit('copy', i);"
          @clone="$emit('clone', i);"
          @down="$emit('down', i);"
          @update="$emit('update', $event)"
        />
      </div>
      <!-- Still used for contextual editing components -->
      <component
        :is="widgetEditorComponent(widget.type)"
        v-if="isContextual && !foreign"
        :key="generation"
        :options="widgetOptions"
        :type="widget.type"
        :model-value="widget"
        :meta="meta"
        :doc-id="docId"
        :focused="isFocused"
        @update="$emit('update', $event)"
        @suppress-widget-controls="isSuppressingWidgetControls = true"
      />
      <component
        :is="widgetComponent(widget.type)"
        v-else
        :id="widget._id"
        :key="`${generation}-preview`"
        :options="widgetOptions"
        :type="widget.type"
        :area-field-id="fieldId"
        :following-values="followingValuesWithParent"
        :model-value="widget"
        :value="widget"
        :meta="meta"
        :foreign="foreign"
        :doc-id="docId"
        :rendering="rendering"
        @edit="$emit('edit', i);"
        @update="$emit('update', $event);"
      />
      <div
        class="
          apos-area-widget-controls
          apos-area-widget-controls--add
          apos-area-widget-controls--add--bottom
        "
        :class="addClasses"
      >
        <AposAreaMenu
          v-if="!foreign"
          :max-reached="maxReached"
          :context-menu-options="bottomContextMenuOptions"
          :index="i + 1"
          :widget-options="widgets"
          :options="options"
          :field-id="fieldId"
          :disabled="disabled"
          :tabbable="isHovered || isFocused"
          :menu-id="`${widget._id}-widget-menu-bottom`"
          :class="{[classes.open]: menuOpen === 'bottom'}"
          :open="menuOpen === 'bottom'"
          @add="$emit('add', $event)"
        />
      </div>
    </div>
  </div>
</template>

<script>
import AposIndicator from 'Modules/@apostrophecms/ui/components/AposIndicator.vue';

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
    meta: {
      type: Object,
      default() {
        return {};
      }
    },
    followingValues: {
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
  emits: [
    'clone',
    'up',
    'down',
    'remove',
    'edit',
    'cut',
    'copy',
    'update',
    'add',
    'changed',
    'paste'
  ],
  data() {
    return {
      mounted: false, // hack around needing DOM to be rendered for computed classes
      isSuppressed: false,
      menuOpen: null,
      isSuppressingWidgetControls: false,
      classes: {
        show: 'apos-is-visible',
        open: 'apos-is-open',
        focus: 'apos-is-focused',
        highlight: 'apos-is-highlighted',
        adjust: 'apos-is-ui-adjusted',
        suppressWidgetControls: 'apos-is-suppressing-widget-controls'
      },
      breadcrumbs: {
        $lastEl: null,
        list: []
      },
      widgets: this.options.widgets || {}
    };
  },
  computed: {
    // Passed only to the preview layer (custom preview components).
    followingValuesWithParent() {
      return Object.entries(this.followingValues || {})
        .reduce((acc, [ key, value ]) => {
          acc[`<${key}`] = value;
          return acc;
        }, {});
    },
    bottomContextMenuOptions() {
      return {
        ...this.contextMenuOptions,
        menuPlacement: 'top'
      };
    },
    widgetIcon() {
      const natural = this.contextMenuOptions.menu
        .filter(item => item.name === this.widget.type)[0]?.icon || 'shape-icon';
      return this.foreign ? 'earth-icon' : natural;
    },
    widgetLabel() {
      const moduleName = `${this.widget.type}-widget`;
      const mod = window.apos.modules[moduleName];
      if (!mod) {
        // eslint-disable-next-line no-console
        console.warn(`No ${moduleName} module found for widget type ${this.widget.type}`);
      }
      return mod.label;
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
    isFocused() {
      if (this.isSuppressed) {
        return false;
      }

      const isWidgetFocused = this.widgetFocused === this.widget._id;
      if (isWidgetFocused) {
        document.addEventListener('click', this.unfocus);
      }

      return isWidgetFocused;
    },
    isHovered() {
      return this.widgetHovered === this.widget._id;
    },
    isHighlighted() {
      const $parent = this.getParent();
      return $parent && $parent.dataset.areaWidget === this.widgetFocused;
    },
    nonForeignHovered() {
      return this.nonForeignWidgetHovered === this.widget._id;
    },
    controlsClasses() {
      return {
        [this.classes.show]: this.isFocused,
        [this.classes.suppressWidgetControls]: this.isSuppressingWidgetControls
      };
    },
    containerClasses() {
      const classes = {
        [this.classes.highlight]: this.isHighlighted || this.isHovered,
        [this.classes.focus]: this.isFocused
      };
      if (this.mounted) {
        classes[this.classes.adjust] = this.adjustUi();
      }
      return classes;
    },
    labelsClasses() {
      return {
        [this.classes.show]: this.isHovered || this.isFocused
      };
    },
    addClasses() {
      return {
        [this.classes.show]: this.isHovered || this.isFocused,
        [`${this.classes.open}--menu-${this.menuOpen}`]: !!this.menuOpen
      };
    },
    foreign() {
      // Cast to boolean is necessary to satisfy prop typing
      return !!(this.docId && (window.apos.adminBar.contextId !== this.docId));
    }
  },
  watch: {
    isFocused(newVal) {
      if (newVal) {
        this.$refs.wrapper.addEventListener('keydown', this.handleKeyboardUnfocus);
      } else {
        this.menuOpen = null;
        this.$refs.wrapper.removeEventListener('keydown', this.handleKeyboardUnfocus);
        this.isSuppressingWidgetControls = false;
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
    this.mounted = true;
    // AposAreaEditor is listening for keyboard input that triggers
    // a 'focus my parent' plea
    apos.bus.$on('widget-focus-parent', this.focusParent);
    apos.bus.$on('context-menu-toggled', this.getFocusForMenu);

    this.breadcrumbs.$lastEl = this.$el;

    this.getBreadcrumbs();

    if (this.widgetFocused) {
      // If another widget was in focus (because the user clicked the "add"
      // menu, for example), and this widget was created, give the new widget
      // focus.
      apos.bus.$emit('widget-focus', { _id: this.widget._id });
    }
  },
  unmounted() {
    // Remove the focus parent listener when unmounted
    apos.bus.$off('widget-focus-parent', this.focusParent);
  },
  methods: {
    getFocusForMenu({ menuId, isOpen }) {
      if (
        (
          menuId === `${this.widget._id}-widget-menu-top` ||
          menuId === `${this.widget._id}-widget-menu-bottom`
        ) &&
        isOpen
      ) {
        const whichMenu = menuId.split('-')[menuId.split('-').length - 1];
        this.menuOpen = whichMenu;
        this.getFocus(null, this.widget._id);
      } else {
        this.menuOpen = null;
      }
    },

    // Determine whether or not we should adjust the label based on its
    // position to the admin bar
    adjustUi() {
      const { height: labelHeight } = this.$refs.label.getBoundingClientRect();
      const { top: widgetTop } = this.$refs.widget.getBoundingClientRect();
      const adminBarHeight = window.apos.modules['@apostrophecms/admin-bar'].height;
      const offsetTop = widgetTop + window.scrollY;
      return offsetTop - labelHeight < adminBarHeight;
    },

    attachKeyboardFocusHandler() {
      this.$refs.wrapper?.addEventListener('keydown', this.handleKeyboardFocus);
    },

    removeKeyboardFocusHandler() {
      this.$refs.wrapper?.removeEventListener('keydown', this.handleKeyboardFocus);
    },

    // Focus parent, useful for obtrusive UI
    focusParent() {
      // Something above us asked the focused widget to try and focus its parent
      // We only care about this if we're focused ...
      if (this.isFocused) {
        const $parent = this.getParent();
        // .. And have a parent
        if ($parent) {
          apos.bus.$emit('widget-focus', { _id: $parent.dataset.areaWidget });
        }
      }
    },

    // Ask the parent AposAreaEditor to make us focused
    getFocus(e, _id) {
      if (e) {
        e.stopPropagation();
      }
      this.isSuppressed = false;
      apos.bus.$emit('widget-focus', { _id });
    },

    // Our widget was hovered
    mouseover(e) {
      if (e) {
        e.stopPropagation();
      }
      const closest = this.foreign && this.$el.closest('[data-apos-widget-foreign="0"]');
      const closestId = closest && closest.getAttribute('data-apos-widget-id');
      apos.bus.$emit('widget-hover', {
        _id: this.widget._id,
        nonForeignId: this.foreign ? closestId : null
      });
    },

    mouseleave() {
      if (this.isHovered) {
        apos.bus.$emit('widget-hover', {
          _id: null,
          nonForeignId: null
        });
      }
    },
    unfocus(event) {
      if (!this.$el.contains(event.target)) {
        this.isSuppressed = true;
        document.removeEventListener('click', this.unfocus);
        apos.bus.$emit('widget-focus', { _id: null });
      }
    },

    handleKeyboardFocus($event) {
      if ($event.key === 'Enter' || $event.code === 'Space') {
        $event.preventDefault();
        this.getFocus($event, this.widget._id);
        this.$refs.wrapper.removeEventListener('keydown', this.handleKeyboardFocus);
      }
    },

    handleKeyboardUnfocus($event) {
      if ($event.key === 'Escape') {
        this.getFocus($event, null);
        document.activeElement.blur();
        this.$refs.wrapper.focus();
      }
    },

    getParent() {
      if (!this.mounted) {
        return false;
      }
      return this.$el.parentNode ? apos.util.closest(this.$el.parentNode, '[data-area-widget]') : false;
    },

    // Hacky way to get the parents tree of a widget
    // would be easier of areas/widgets were recursively calling each other and
    // able to pass data all the way down
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
@mixin showButton() {
  transform: scale(1.15);
  background-size: 150% 100%;
  border-radius: 10px;
  transition-duration: 500ms;

  /* stylelint-disable-next-line max-nesting-depth */
  .apos-button__label {
    max-width: 100px;
    max-height: 100px;
    transition-duration: 500ms;
    padding: 0 5px 0 0;
  }

  /* stylelint-disable-next-line max-nesting-depth */
  .apos-button__icon {
    margin-right: 5px;
  }
}

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
    transition: outline 200ms ease;

    &:focus {
      box-shadow: 0 0 11px 1px var(--a-primary-transparent-25);
      outline: 1px dashed var(--a-primary-transparent-50);
      outline-offset: 2px;
    }

    &.apos-is-highlighted {
      outline: 1px dashed var(--a-primary-transparent-50);
    }

    &.apos-is-focused {
      outline: 1px dashed var(--a-primary);

      &:deep(.apos-rich-text-editor__editor.apos-is-visually-empty) {
        box-shadow: none;
      }
    }

    &.apos-is-ui-adjusted {
      .apos-area-widget-controls--modify {
        top: 0;
        transform: translate3d(-10px, 50px, 0);
      }

      .apos-area-widget__label {
        transform: translate(-10px, 10px);
      }
    }

    .apos-area-widget-inner &::after {
      display: none;
    }

    .apos-area-widget-inner &::before {
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

    .apos-area-widget-inner &.apos-is-focused::before,
    .apos-area-widget-inner &.apos-is-highlighted::before {
      z-index: $z-index-default;
    }
  }

  .apos-area-widget-inner .apos-area-widget-inner {
    &.apos-is-highlighted::before {
      opacity: 0.1;
    }

    &.apos-is-focused::before {
      opacity: 0.15;
    }
  }

  .apos-area-widget-controls {
    z-index: $z-index-widget-controls;
    position: absolute;
    opacity: 0;
    pointer-events: none;
    transition: all 300ms ease;

    &.apos-area-widget__label {
      z-index: $z-index-widget-label;
    }

    &.apos-is-focused {
      z-index: $z-index-widget-focused-controls;
    }
  }

  .apos-area-widget-controls--modify {
    z-index: $z-index-widget-focused-controls;
    top: 50%;
    right: 0;
    transform: translate3d(-10px, -50%, 0);

    :deep(.apos-button-group__inner) {
      border: 1px solid var(--a-primary-transparent-25);
      box-shadow: var(--a-box-shadow);
    }

    :deep(.apos-button-group) .apos-button {
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

      &:focus:not([disabled])::after {
        background-color: transparent;
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

    &.apos-area-widget-controls--add--top.apos-is-open--menu-top,
    &.apos-area-widget-controls--add--bottom.apos-is-open--menu-bottom {
      z-index: $z-index-area-schema-ui;
    }
  }

  .apos-area-widget-controls--add {
    &.apos-area-widget-controls--add--top.apos-is-open--menu-top,
    &.apos-area-widget-controls--add--bottom.apos-is-open--menu-bottom {

      /* stylelint-disable-next-line max-nesting-depth */
      :deep(.apos-button__wrapper .apos-button:not([disabled])) {
        @include showButton;
      }
    }
  }

  .apos-area-widget-controls--add {
    :deep(.apos-button__wrapper) {
      padding: 8px;

      &:hover .apos-button:not([disabled]) {
        @include showButton;
      }
    }

    :deep(.apos-button__icon) {
      margin-right: 0;
    }

    :deep(.apos-button__label) {
      display: inline-block;
      overflow: hidden;
      font-size: var(--a-type-small);
      transition: max-width 200ms var(--a-transition-timing-bounce);
      max-width: 0;
      max-height: 0;
      white-space: nowrap;
    }

    :deep(.apos-button) {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 5px;
      transition: all 200ms var(--a-transition-timing-bounce);
      background-image: linear-gradient(
        45deg,
        var(--a-primary),
        var(--a-primary-dark-15),
        var(--a-primary-light-40),
        var(--a-primary)
      );
      background-size: 200% 100%;
      border-radius: 12px;
    }
  }

  .apos-area-widget-controls--add--bottom {
    top: auto;
    bottom: 0;
    transform: translate(-50%, 50%);
  }

  .apos-area-widget-inner :deep(.apos-context-menu__popup.apos-is-visible) {
    top: calc(100% + 20px);
    left: 50%;
    transform: translate(-50%, 0);
  }

  .apos-area-widget__label {
    position: absolute;
    top: 0;
    right: 0;
    display: flex;
    transform: translateY(-100%);
    transition: opacity 300ms ease;
  }

  .apos-area-widget-inner .apos-area-widget-inner .apos-area-widget__label {
    right: auto;
    left: 0;
  }

  .apos-area-widget__breadcrumbs {
    @include apos-list-reset();

    & {
      display: flex;
      align-items: center;
      margin: 0 0 8px;
      padding: 4px 6px;
      background-color: var(--a-background-primary);
      border: 1px solid var(--a-primary-transparent-50);
      border-radius: 8px;
    }
  }

  .apos-area-widget__breadcrumb,
  .apos-area-widget__breadcrumb :deep(.apos-button__content) {
    @include type-help;

    & {
      padding: 2px;
      white-space: nowrap;
      color: var(--a-base-1);
      transition: background-color 300ms var(--a-transition-timing-bounce);
    }
  }

  .apos-area-widget__breadcrumbs:hover .apos-area-widget__breadcrumb,
  .apos-area-widget__breadcrumbs:hover .apos-area-widget__breadcrumb
    :deep(.apos-button__content) {
    color: var(--a-text-primary);
  }

  .apos-area-widget__breadcrumb--widget-icon {
    margin-right: 2px;
    padding: 3px 2px 2px;
    color: var(--a-primary);
    transition: background-color 300ms var(--a-transition-timing-bounce);
    background-color: var(--a-primary-transparent-10);
    border-radius: 4px;
  }

  .apos-area-widget__breadcrumbs:hover .apos-area-widget__breadcrumb--widget-icon {
    background-color: var(--a-primary-transparent-25);
  }

  .apos-area-widget__breadcrumb--icon {
    padding: 2px;
    color: var(--a-text-primary);
  }

  .apos-area-widget__breadcrumb :deep(.apos-button) {
    color: var(--a-primary-dark-10);

    &:hover, &:active, &:focus {
      .apos-button__content {
        color: var(--a-primary);
      }
    }
  }

  .apos-is-visible:not(.apos-is-suppressing-widget-controls),
  .apos-is-focused {
    opacity: 1;
    pointer-events: auto;
  }

</style>
