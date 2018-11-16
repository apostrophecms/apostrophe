<template>
  <div class="apos-area">
    <ApostropheAddWidgetMenu @widgetAdded="insert" :index="0" :choices="choices" :widgetOptions="options.widgets" />
    <div v-for="(id, i) in next" :key="id">
      <div class="apos-area-controls">
        <button v-if="i > 0" @click="up(i)">Up</button>
        <button v-if="i < items.length + 1" @click="down(i)">Down</button>
        <button @click="remove(i)">Remove</button>
        <button @click="edit(i)">Edit</button>
      </div>
      <!-- v-model cannot reference the "widget" iteration variable but it -->
      <!-- does not mind if we reference next[i] directly -->
      <component v-if="editing[id]" @save="editing[id] = false" @close="editing[id] = false" :is="widgetEditorComponent(widgets[id].type)" v-model="widgets[id]" :options="options.widgets[widgets[id].type]" :type="widgets[id].type" />
      <component :is="widgetComponent(widgets[id].type)" v-model="widgets[id]" :options="options.widgets[widgets[id].type]" :type="widgets[id].type" />
      <ApostropheAddWidgetMenu @widgetAdded="insert" :index="i + 1" :choices="choices" :widgetOptions="options.widgets" />
    </div>
  </div>
</template>

<script>

import Vue from 'apostrophe/vue';

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
      next: this.items.map((item) => item._id),
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
      return this.next.map(id => this.widgets[id]);
    }
  },
  computed: {
    moduleOptions() {
      return window.apos.areas;
    }
  }
};

</script>
