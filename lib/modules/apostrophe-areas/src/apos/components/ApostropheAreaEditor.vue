<template>
  <div class="apos-area">
    <ApostropheAddWidgetMenu @widgetAdded="insert" :index="0" :choices="choices" :widgetOptions="options.widgets" />
    <vddl-list class="apos-areas-widgets-list" :list="next" :horizontal="false">
      <vddl-draggable class="panel__body--item" v-for="(item, i) in next" :key="item.id"
          :draggable="item"
          :index="i"
          :wrapper="next"
          effect-allowed="move"
      >
        <div class="apos-area-controls">
          <button v-if="i > 0" @click="up(i)">Up</button>
          <button v-if="i < next.length - 1" @click="down(i)">Down</button>
          <button @click="remove(i)">Remove</button>
          <button @click="edit(i)">Edit</button>
        </div>
        <component v-if="editing[item.id]" @save="editing[item.id] = false" @close="editing[item.id] = false" :is="widgetEditorComponent(widgets[item.id].type)" v-model="widgets[item.id]" :options="options.widgets[widgets[item.id].type]" :type="widgets[item.id].type" />
        <component :is="widgetComponent(widgets[item.id].type)" v-model="widgets[item.id]" :options="options.widgets[widgets[item.id].type]" :type="widgets[item.id].type" :docId="widgets[item.id].__docId" />
        <ApostropheAddWidgetMenu @widgetAdded="insert" :index="i + 1" :choices="choices" :widgetOptions="options.widgets" />
      </vddl-draggable>
    </vddl-list>
  </div>
</template>

<script>

import Vue from 'apostrophe/vue';
import Vddl from 'vddl';
Vue.use(Vddl);

export default {
  name: 'ApostropheAreaEditor',
  props: {
    options: Object,
    items: Array,
    choices: Array
  },
  data() {
    const widgets = {};
    this.items.forEach(
      item => widgets[item._id] = item
    );
    return {
      next: this.items.map((item) => ({ id: item._id })),
      editing: {},
      widgets: widgets
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
    widgets: {
      deep: true,
      handler() {
        this.$emit('input', this.nextItems());
      }
    }
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
      Vue.delete(this.widgets, this.next[i]);
      this.next = this.next.slice(0, i).concat(this.next.slice(i + 1));
    },
    edit(i) {
      Vue.set(this.editing, this.next[i], !this.editing[this.next[i]]);
    },
    insert($event) {
      this.next.splice($event.index, 0, $event.widget._id);
      this.widgets[$event.widget._id] = $event.widget;
    },
    widgetComponent(type) {
      return this.moduleOptions.components.widgets[type];
    },
    widgetEditorComponent(type) {
      return this.moduleOptions.components.widgetEditors[type];
    },
    nextItems() {
      return this.next.map(item => Object.assign({}, this.widgets[item.id]));
    }
  },
  computed: {
    moduleOptions() {
      return window.apos.areas;
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
</style>