<template>
  <div class="apos-area">
    <ApostropheAddWidgetMenu @widgetAdded="insert" :index="0" :choices="choices" :widgetOptions="options.widgets" />
    <vddl-list :allowed-types="types" class="apos-areas-widgets-list"
      :list="next"
      :horizontal="false"
      :drop="handleDrop"
    >
      <vddl-draggable class="panel__body--item" v-for="(wrapped, i) in next" :key="wrapped.widget._id"
          :type="wrapped.widget.type"
          :draggable="wrapped"
          :index="i"
          :wrapper="next"
          :moved="handleMoved"
          effect-allowed="move"
      >
        <div class="apos-area-controls">
          <button v-if="i > 0" @click="up(i)">Up</button>
          <button v-if="i < next.length - 1" @click="down(i)">Down</button>
          <button @click="remove(i)">Remove</button>
          <button @click="edit(i)">Edit</button>
        </div>
        <component v-if="editing[wrapped.widget._id]" @save="editing[wrapped.widget._id] = false" @close="editing[wrapped.widget._id] = false" :is="widgetEditorComponent(wrapped.widget.type)" v-model="wrapped.widget" :options="options.widgets[wrapped.widget.type]" :type="wrapped.widget.type" />
        <component v-if="(!editing[wrapped.widget._id]) || (!widgetIsContextual(wrapped.widget.type))" :is="widgetComponent(wrapped.widget.type)" :options="options.widgets[wrapped.widget.type]" :type="wrapped.widget.type" :docId="wrapped.widget.__docId" :value="wrapped.widget" @edit="edit(i)" />
        <ApostropheAddWidgetMenu @widgetAdded="insert" :index="i + 1" :choices="choices" :widgetOptions="options.widgets" />
      </vddl-draggable>
    </vddl-list>
  </div>
</template>

<script>

import Vue from 'apostrophe/vue';
import Vddl from 'vddl';
// TODO this would be better globally added somewhere global,
// or figure out how not to globally add it
Vue.use(Vddl);

export default {
  name: 'ApostropheAreaEditor',
  props: {
    options: Object,
    items: Array,
    choices: Array
  },
  data() {
    return {
      next: this.items.map(widget => ({ widget })),
      editing: {},
      droppedItem : {}
    };
  },
  watch: {
    // Per rideron89 we must use a "deep" watcher because
    // we are interested in subproperties
    next: {
      deep: true,
      handler() {
        this.$emit('input', this.nextItems());
      }
    },
  },
  methods: {
    up(i) {
      const previous = this.next[i - 1];
      Vue.set(this.next, i - 1, this.next[i]);
      Vue.set(this.next, i, previous);
    },
    down(i) {
      const temp = this.next[i + 1];
      Vue.set(this.next, i + 1, this.next[i]);
      Vue.set(this.next, i, temp);
    },
    remove(i) {
      this.next = this.next.slice(0, i).concat(this.next.slice(i + 1));
    },
    edit(i) {
      Vue.set(this.editing, this.next[i].widget._id, !this.editing[this.next[i].widget._id]);
    },
    insert($event) {
      this.next.splice($event.index, 0, { widget: $event.widget });
      if (this.widgetIsContextual($event.widget.type)) {
        this.edit($event.index);
      }
    },
    widgetComponent(type) {
      return this.moduleOptions.components.widgets[type];
    },
    widgetEditorComponent(type) {
      return this.moduleOptions.components.widgetEditors[type];
    },
    widgetIsContextual(type) {
      return this.moduleOptions.widgetIsContextual[type];
    },
    nextItems() {
      return this.next.map(wrapped => Object.assign({}, wrapped.widget));
    },
    handleDrop(data) {
      const { index, list, item } = data;
      item.widget._id = `${item.widget._id}_dropped`;
      this.droppedItem = item;

      list.splice(index, 0, item);
    },
    handleMoved(data) {
      const { index, list, draggable } = data;
      const id = draggable.widget._id;
      draggable.widget._id = `${draggable.widget._id}_moved`;
      this.droppedItem.widget._id = id;

      list.splice(index, 1);
    }
  },
  computed: {
    moduleOptions() {
      return window.apos.areas;
    },
    types() {
      return Object.keys(this.options.widgets);
    }
  }
};

</script>


<style>
  .apos-area {
    border: 2px solid green;
    margin: 5px;
    padding: 5px;
  }
.apos-areas-widgets-list {
    min-height: 64px;
  }
</style>
