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
        class="apos-area-widget-controls apos-area-widget-controls--add"
        :class="ui.addTop"
      >
        <AposAreaMenu
          @add="insert"
          @menuOpen="menuFocus('top')"
          @menuClose="menuUnfocus('top')"
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
        data-apos-widget
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
          @menuOpen="menuFocus('bottom')"
          @menuClose="menuUnfocus('bottom')"
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
    const s = {
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
      }
    };
    return {
      blankState: klona(s),
      state: klona(s),
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
      if (this.widgetFocused === this.widgetId) {
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
  methods: {

    // EVENTS

    widgetMouseover(e) {
      e.stopPropagation();
      this.state.move.show = true;
      this.state.container.highlight = true;
      apos.bus.$emit('widget-hover', this.widgetId);
    },

    widgetMouseleave() {
      this.state.move.show = false;
      this.state.container.highlight = false;
    },

    widgetFocus(e) {
      e.stopPropagation();
      this.state.container.focus = true;
      this.state.modify.show = true;
      this.state.add.top.show = true;
      this.state.add.bottom.show = true;
      document.addEventListener('click', this.widgetUnfocus);
      apos.bus.$emit('widget-focus', this.widgetId);
    },

    widgetUnfocus(event) {
      console.log('blur?');
      if (!this.$el.contains(event.target)) {
        this.resetState();
        document.removeEventListener('click', this.blurUnfocus);
        apos.bus.$emit('widget-mouseover', null);
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

  .apos-area-widget-controls.apos-show,
  .apos-area-widget-controls.apos-focus {
    opacity: 1;
    pointer-events: auto;
  }

  .apos-area-widget-controls.apos-focus {
    z-index: $z-index-default;
  }

  .apos-area-widget-controls--add {
    top: 0;
    left: 50%;
    transform: translate3d(-50%, calc(-50% - #{$offset-0}), 0);
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
</style>