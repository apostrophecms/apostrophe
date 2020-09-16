<template>
  <div class="apos-area-widget-wrapper" :data-area-widget="widgetId">
    <div
      class="apos-area-widget-inner"
      :class="ui.container"
      @mouseover="handleMouseover($event)"
      @mouseleave="handleMouseleave"
      @click="handleFocus($event)"
    >
      <div
        class="apos-area-widget-controls apos-area-widget-controls--add"
        :class="ui.addTop"
      >
        <AposAreaMenu
          @add="insert"
          @menuOpen="focusMenu('top')"
          @menuClose="unfocusMenu('top')"
          :context-options="contextOptions"
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
          @up="up(i)"
          @down="down(i)"
        />
      </div>
      <div
        class="apos-area-widget-controls apos-area-widget-controls--modify"
        :class="ui.modify"
      >
        <AposWidgetModify
          @remove="remove(i)"
          @edit="edit(i)"
        />
      </div>
      <component
        v-if="editing[widget._id]"
        @save="editing[widget._id] = false"
        @close="editing[widget._id] = false"
        :is="widgetEditorComponent(widget.type)"
        :value="widget"
        @update="update"
        :options="options.widgets[widget.type]"
        :type="widget.type"
        :doc-id="docId"
      />
      <component
        v-if="(!editing[widget._id]) || (!widgetIsContextual(widget.type))"
        :is="widgetComponent(widget.type)"
        :options="options.widgets[widget.type]"
        :type="widget.type"
        :id="widget._id"
        :area-field-id="fieldId"
        :value="widget"
        @edit="edit(i)"
        :doc-id="docId"
        data-apos-widget
      />
      <div
        class="apos-area-widget-controls apos-area-widget-controls--add apos-area-widget-controls--add--bottom"
        :class="ui.addBottom"
      >
        <AposAreaMenu
          @add="insert"
          :context-options="contextOptions"
          :index="i + 1"
          :widget-options="options.widgets"
          @menuOpen="focusMenu('bottom')"
          @menuClose="unfocusMenu('bottom')"
        />
      </div>
    </div>
  </div>
</template>

<script>

import Vue from 'apostrophe/vue';
import cuid from 'cuid';

export default {
  name: 'AposAreaWidget',
  props: {
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
    editing: {
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
    contextOptions: {
      type: Object,
      required: true
    }
  },
  emits: [ 'up', 'down', 'remove', 'edit', 'update', 'insert', 'changed' ],
  data() {
    const state = {
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
          show: false
        },
        top: {
          show: false
        }
      }
    };
    return {
      state,
      suppressedState: { ...state },
      show: 'apos-show',
      open: 'apos-open',
      focus: 'apos-focus',
      highlight: 'apos-highlight'
    };
  },
  computed: {
    moduleOptions() {
      return window.apos.area;
    },
    widgetId() {
      return cuid();
    },
    isSuppressed() {
      if (this.widgetHovered) {
        return this.widgetHovered !== this.widgetId;
      } else {
        return false;
      }
    },
    ui() {
      if (this.isSuppressed) {
        return this.suppressedState;
      } else {
        return {
          move: this.state.move.show ? this.show : null,
          modify: this.state.modify.show ? this.show : null,
          container: this.state.container.focus ? this.focus
            : (this.state.container.highlight ? this.highlight : null),
          addTop: this.state.add.top.show ? this.show : null,
          addBottom: this.state.add.bottom.show ? this.show : null
        };
      }
    }
  },
  mounted() {
    // apos.bus.$on('area-event', this.areaEventReceiver);
  },
  methods: {
    areaEventReceiver(area, ...args) {
      if (apos.util.closest(area.$el.parentNode, '[data-apos-area]') === this.$el) {
        const $widget = apos.util.closest(area.$el, '[data-apos-widget]');
        console.log($widget);
        console.log(this.next);
        const widget = this.next.find(widget => widget._id === $widget.getAttribute('id'));
        console.log(widget);
        this.onChildAreaEvent(area, widget, ...args);
      } else {
        console.log('received, but not for us');
      }
    },

    // Emit an event from this area to its parent area, even though they
    // are in separate Vue apps. Results in a call to onAreaEvent in the
    // parent area, and only that area.
    //
    // You must pass a name argument, to distinguish your different
    // child area events, and you may pass more arguments.
    emitToParentArea(name, ...args) {
      apos.bus.$emit('area-event', this.area, name, ...args);
    },
    // Receive an event from a child area, even though they are in
    // separate Vue apps. inWidget is the widget within this.next in which
    // childArea is nested. All incoming arguments after `name` wind up in the
    // `args` array.
    onChildAreaEvent(childArea, inWidget, name, ...args) {
      console.log('stus ver: The descendant area', childArea, 'nested directly in our child widget', inWidget, 'emitted a ', name, ' event with these arguments:', args);
    },

    // EVENTS

    handleMouseover(e) {
      e.stopPropagation();
      this.state.move.show = true;
      this.state.container.highlight = true;
      apos.bus.$emit('widget-hover', this.widgetId);
    },

    handleMouseleave() {
      this.state.move.show = false;
      this.state.container.highlight = false;
    },

    handleFocus($event) {
      $event.stopPropagation();
      this.state.container.focus = true;
      document.addEventListener('click', this.blurUnfocus);
      apos.bus.$emit('widget-focus', this.widgetId);
    },

    focusMenu(which) {
      this.state.add[which].show = true;
    },

    unfocusMenu(which) {
      this.state.add[which].show = false;
    },

    // misc
    blurUnfocus(event) {
      if (!this.$el.contains(event.target)) {
        this.state.container.focus = false;
        this.state.container.highlight = false;
        document.removeEventListener('click', this.blurUnfocus);
        apos.bus.$emit('widget-mouseover', null);
      }
    },

    // events to emit
    up(i) {
      this.$emit('up', i);
    },
    down(i) {
      this.$emit('down', i);
    },
    remove(i) {
      this.$emit('remove', i);
    },
    edit(i) {
      this.$emit('edit', i);
    },
    update(widget) {
      this.$emit('update', widget);
    },
    insert(e) {
      this.$emit('insert', e);
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
  .apos-area-widget-inner {
    position: relative;
    min-height: 50px;
    outline-offset: $offset-0;
  }

  .apos-highlight {
    outline: 1px dotted var(--a-primary);
  }

  .apos-area-widget-inner.apos-focus {
    z-index: $z-index-default;
    outline: 1px solid var(--a-primary);
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
  .apos-area-widget-controls--move {
    top: 50%;
    left: calc(-1 * #{$offset-0 + 5});
    transform: translate3d(-100%, -50%, 0);
  }

  .apos-area-widget-controls--move.apos-focus {
    opacity: 1;
    pointer-events: auto;
  }

  .apos-area-widget-controls.apos-show {
    opacity: 1;
    pointer-events: auto;
  }

  .apos-area-widget-controls--add {
    top: 0;
    left: 50%;
    transform: translate3d(-50%, calc(-50% - #{$offset-0}), 0);
  }

  .apos-area-widget-controls--add.apos-focus {
    z-index: $z-index-default;
  }

  .apos-area-widget-controls--add--bottom {
    top: auto;
    bottom: 0;
    transform: translate3d(-50%, calc(50% + #{$offset-0}), 0);
  }

  .apos-area-widget-inner /deep/ .apos-context-menu__popup.is-visible {
    top: calc(100% + 20px);
    left: 50%;
    transform: translate(-50%, 0);
  }

  .apos-supress {
    outline: 3px solid var(--a-danger);
  }
</style>