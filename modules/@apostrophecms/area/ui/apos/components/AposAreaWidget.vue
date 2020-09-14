<template>
  <div class="apos-area-widget-wrapper">
    <div
      class="apos-area-widget-inner"
      :class="[state.container, { 'apos-supress': supressStatus }]"
      @mouseover="handleMouseover"
      @mouseleave="handleMouseleave"
      @click="handleFocus($event)"
    >
      <div
        class="apos-area-widget-controls apos-area-widget-controls--add"
        :class="state.addTop"
        >
        <AposAreaMenu
          @add="insert"
          @menuOpen="focusMenu('addTop')"
          @menuClose="unfocusMenu('addTop')"
          :context-options="contextOptions"
          :index="i"
          :widget-options="options.widgets"
        />
      </div>
      <div
        class="apos-area-widget-controls apos-area-widget-controls--move"
        :class="state.move"
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
        :class="state.modify"
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
      />
      <div 
        class="apos-area-widget-controls apos-area-widget-controls--add apos-area-widget-controls--add--bottom"
        :class="state.addBottom"
        >
        <AposAreaMenu
          @add="insert"
          :context-options="contextOptions"
          :index="i + 1"
          :widget-options="options.widgets"
          @menuOpen="focusMenu('addBottom')"
          @menuClose="unfocusMenu('addBottom')"
        />
      </div>
    </div>
  </div>
</template>

<script>
import Vue from 'apostrophe/vue';
export default {
  name: 'AposAreaWidget',
  props: {
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
    },
    supressStatus: {
      type: Boolean,
      default: false
    }
  },
  emits: [ 'up', 'down', 'remove', 'edit', 'update', 'insert', 'changed' ],
  data() {
    return {
      state: {
        move: [],
        modify: [],
        container: [],
        addTop: [],
        addBottom: []
      },
      show: 'apos-show',
      open: 'apos-open',
      focus: 'apos-focus',
      highlight: 'apos-highlight',
      supress: 'apos-supress'
    };
  },
  computed: {
    moduleOptions() {
      return window.apos.area;
    }
  },
  methods: {

    // EVENTS

    handleMouseover() {
      this.showMove();
      this.highlightContainer();
      // this.$emit('supress');
    },

    handleMouseleave() {
      this.removeMove();
      this.unhighlightContainer();
    },

    handleFocus($event) {
      $event.stopPropagation();
      document.addEventListener('click', this.blurUnfocus);
      this.showFocus();
      // remove all other focus states
      // this.$emit('supress');
      // for (let k in this.states) {
      //   this.states[k].container = this.states[k].container.filter(i => { return i !== this.focus });
      //   this.states[k].modify = this.states[k].modify.filter(i => { return i !== this.show });
      //   this.states[k].addTop = this.states[k].addTop.filter(i => { return i !== this.show });
      //   this.states[k].addBottom = this.states[k].addBottom.filter(i => { return i !== this.show });
      //   this.states[k].move = this.states[k].move.filter(i => { return i !== this.focus });
      // }


    },

    // ACTIONS

    toggleSupress() {
      if (this.state.container.includes(this.supress)) {
        this.state.container = this.removeClass(this.state.container, this.supress);  
      } else {
        this.addClass(this.state.container, this.supress);
      }
    },

    focusMenu(which) {
      this.addClass(this.state[which], this.focus);
    },

    unfocusMenu(which) {
      this.state[which] = this.removeClass(this.state[which], this.focus);
    },

    showMove() {
      this.addClass(this.state.move, this.show);
    },

    removeMove() {
      this.state.move = this.removeClass(this.state.move, this.show);
    },

    focusMove() {
      this.addClass(this.state.move, this.focus);
    },

    unfocusMove() {
      this.state.move = this.removeClass(this.state.move, this.focus);
    },

    highlightContainer() {
      this.addClass(this.state.container, this.highlight);
    },

    unhighlightContainer() {
      this.state.container = this.removeClass(this.state.container, this.highlight);
    },

    showModify() {
      this.addClass(this.state.modify, this.show);
    },

    removeModify() {
      this.state.modify = this.removeClass(this.state.modify, this.show);
    },

    showAddControls() {
      this.addClass(this.state.addBottom, this.show);
      this.addClass(this.state.addTop, this.show);
    },

    hideAddControls() {
      this.state.addBottom = this.removeClass(this.state.addBottom, this.show);
      this.state.addTop = this.removeClass(this.state.addTop, this.show);
    },

    showFocus() {
      this.showModify();

      // add focus states
      this.addClass(this.state.container, this.focus);
      this.addClass(this.state.move, this.focus);

      this.showAddControls();
    },

    removeFocus() {
      this.removeModify();
      this.removeMove();
      this.unfocusMove();
      // remove container focus
      this.state.container = this.removeClass(this.state.container, this.focus);
      this.state.move = this.removeClass(this.state.move, this.show);

      this.hideAddControls();
    },

    // misc
    blurUnfocus(event) {
      if (!this.$el.contains(event.target)) {
        this.removeFocus();
        document.removeEventListener('click', this.blurUnfocus);
      }
    },

    // soft append
    addClass(what, c) {
      if (!what.includes(c)) {
        what.push(c);
      }
    },

    // filter class off array
    removeClass(what, c) {
      return what.filter(i => { return i !== c; });
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