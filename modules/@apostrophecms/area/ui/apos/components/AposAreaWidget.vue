
<template>
  <div class="apos-area-widget-wrapper" :data-area-widget="widgetId">
    <div
      class="apos-area-widget-inner"
      :class="ui.container"
      @mouseover="widgetMouseover($event)"
      @mouseleave="widgetMouseleave"
      @click="widgetFocus($event)"
    >
      <div
        class="apos-area-widget-controls apos-area-widget__label"
        :class="ui.labels"
      >
        <p class="apos-area-widget__type">
          {{ widgetLabel }}
        </p>
      </div>
      <div
        class="apos-area-widget-controls apos-area-widget-controls--add apos-area-widget-controls--add--top"
        :class="ui.addTop"
      >
        <AposAreaMenu
          @add="$emit('insert', $event);"
          @menu-open="menuFocus('top')"
          @menu-close="menuUnfocus('top')"
          :context-menu-options="contextMenuOptions"
          :index="i"
          :widget-options="options.widgets"
        />
      </div>
      <div
        class="apos-area-widget-controls apos-area-widget-controls--move"
        :class="ui.move"
      >
        <AposWidgetMove
          :first="i === 0"
          :last="i === next.length - 1"
          @up="$emit('up', i);"
          @down="$emit('down', i);"
        />
      </div>
      <div
        class="apos-area-widget-controls apos-area-widget-controls--modify"
        :class="ui.modify"
      >
        <AposWidgetModify
          @remove="$emit('remove', i);"
          @edit="$emit('edit', i);"
        />
      </div>
      <component
        v-if="editing"
        @save="$emit('done', widget)"
        @close="$emit('close', widget)"
        :is="widgetEditorComponent(widget.type)"
        :value="widget"
        @update="$emit('update', $event)"
        :options="options.widgets[widget.type]"
        :type="widget.type"
        :doc-id="docId"
        data-apos-widget
      />
      <component
        v-if="(!editing) || (!widgetIsContextual(widget.type))"
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
          @add="$emit('insert', $event)"
          :context-menu-options="contextMenuOptions"
          :index="i + 1"
          :widget-options="options.widgets"
          @menu-open="menuFocus('bottom')"
          @menu-close="menuUnfocus('bottom')"
        />
      </div>
    </div>
  </div>
</template>

<script>

import Vue from 'apostrophe/vue';
import cuid from 'cuid';
import klona from 'klona';

export default {
  name: 'AposAreaWidget',
  props: {
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
    }
  },
  emits: [ 'done', 'close', 'up', 'down', 'remove', 'edit', 'update', 'insert', 'changed' ],
  data() {
    const initialState = {
      move: {
        show: false
      },
      modify: {
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
      show: 'apos-show',
      open: 'apos-open',
      focus: 'apos-focus',
      highlight: 'apos-highlight'
    };
  },
  computed: {
    widgetLabel() {
      return window.apos.modules[`${this.widget.type}-widget`].label;
    },
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
        move: this.state.move.show ? this.show : null,
        modify: this.state.modify.show ? this.show : null,
        labels: this.state.labels.show ? this.show : null,
        container: this.state.container.focus ? this.focus
          : (this.state.container.highlight ? this.highlight : null),
        addTop: this.state.add.top.focus ? this.focus
          : (this.state.add.top.show ? this.show : null),
        addBottom: this.state.add.bottom.focus ? this.focus
          : (this.state.add.bottom.show ? this.show : null)
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
        this.focused = true;
      }
      const $parents = apos.util.closest(this.$el.parentNode, '[data-area-widget]');
      if (
        $parents &&
        $parents.dataset.areaWidget === newVal
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
  methods: {

    // EVENTS

    widgetMouseover(e) {
      if (e) {
        e.stopPropagation();
      }
      this.state.move.show = true;
      this.state.container.highlight = true;
      this.state.labels.show = true;
      apos.bus.$emit('widget-hover', this.widgetId);
    },

    widgetMouseleave() {
      // Force move controls while focused
      if (!this.focused) {
        this.state.move.show = false;
      }
      if (!this.highlightable) {
        // Force highlight when a parent has been focused
        this.state.container.highlight = false;
      }
      this.state.labels.show = false;
    },

    widgetFocus(e) {
      e.stopPropagation();
      this.state.container.focus = true;
      this.state.modify.show = true;
      this.state.add.top.show = true;
      this.state.add.bottom.show = true;
      this.state.labels.show = false;
      document.addEventListener('click', this.widgetUnfocus);
      apos.bus.$emit('widget-focus', this.widgetId);
    },

    widgetUnfocus(event) {
      if (!this.$el.contains(event.target)) {
        this.resetState();
        this.highlightable = false;
        document.removeEventListener('click', this.blurUnfocus);
        apos.bus.$emit('widget-focus', null);
      }
    },

    menuFocus(which) {
      this.state.add[which].focus = true;
    },

    menuUnfocus(which) {
      this.state.add[which].focus = false;
    },

    resetState() {
      this.state = klona(this.blankState);
    },

    widgetComponent(type) {
      return this.moduleOptions.components.widgets[type];
    },
    widgetEditorComponent(type) {
      return this.moduleOptions.components.widgetEditors[type];
    },
    widgetIsContextual(type) {
      return this.moduleOptions.widgetIsContextual[type];
    }
  }
};
</script>

<style lang="scss" scoped>
  $offset-0: 10px;
  $offset-1: 5px;

  .apos-area-widget-inner {
    position: relative;
    min-height: 50px;
    outline-offset: $offset-0;
  }

  .apos-area-widget-inner .apos-area-widget-inner {
    outline-offset: $offset-1;
  }

  .apos-highlight {
    outline: 1px dotted var(--a-primary);
  }

  .apos-area-widget-inner.apos-focus {
    z-index: $z-index-default;
    outline: 1px solid var(--a-primary);
  }

  .apos-area-widget-inner .apos-area-widget-inner {
    &.apos-highlight, &.apos-focus {
      outline-color: var(--a-secondary);
    }
  }

  .apos-area-widget-controls {
    position: absolute;
    opacity: 0;
    pointer-events: none;
    transition: all 0.3s ease;
  }

  .apos-area-widget-controls--modify {
    top: calc(-1 * #{$offset-0});
    transform: translateY(-85%);
  }

  .apos-area-widget-inner .apos-area-widget-inner .apos-area-widget-controls--modify {
    top: calc(-1 * #{$offset-1});
  }

  .apos-area-widget-controls--move {
    top: 50%;
    left: 0;
    padding-right: $offset-0 * 2;
    transform: translate3d(-100%, -50%, 0);
  }

  .apos-area-widget-inner .apos-area-widget-inner .apos-area-widget-controls--move {
    padding-right: $offset-1 * 2;
  }

  .apos-area-widget-controls--add {
    top: 0;
    left: 50%;
    transform: translate3d(-50%, calc(-50% - #{$offset-0}), 0);
  }

  .apos-area-widget-inner .apos-area-widget-inner .apos-area-widget-controls--add--top {
    transform: translate3d(-50%, calc(-50% - #{$offset-1}), 0);
  }

  .apos-area-widget-controls--add--bottom {
    top: auto;
    bottom: 0;
    transform: translate3d(-50%, calc(50% + #{$offset-0}), 0);
  }

  .apos-area-widget-inner .apos-area-widget-inner .apos-area-widget-controls--add--bottom {
    transform: translate3d(-50%, calc(50% + #{$offset-1}), 0);
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
    bottom: calc(100% + #{$offset-0});
    left: $offset-0;
    display: flex;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    font-size: map-get($font-sizes, meta);
  }

  .apos-area-widget-inner .apos-area-widget-inner .apos-area-widget__label {
    bottom: calc(100% + #{$offset-1});
  }

  .apos-area-widget__type {
    margin: 0;
    padding: 2px 4px;
    background-color: var(--a-primary);
    color: var(--a-white);
  }

  .apos-area-widget-inner .apos-area-widget-inner .apos-area-widget__type {
    background-color: var(--a-secondary);
  }

  .apos-show, .apos-focus {
    opacity: 1;
    pointer-events: auto;
  }

  .apos-focus {
    z-index: $z-index-default;
  }

</style>
