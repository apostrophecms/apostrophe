<template>
  <div class="apos-area">
    <ApostropheAddWidgetMenu @widgetAdded="insert" :index="0" :choices="choices" :widgetOptions="options.widgets" />
    <div v-for="(widget, i) in next">
      <div class="apos-area-controls">
        <button v-if="i > 0" @click="up(i)">Up</button>
        <button v-if="i < items.length + 1" @click="down(i)">Down</button>
        <button @click="remove(i)">Remove</button>
        <button @click="edit(i)">Edit</button>
      </div>
      <!-- v-model cannot reference the "widget" iteration variable but it -->
      <!-- does not mind if we reference next[i] directly -->
      <component v-if="editing[widget._id]" @close="editing[widget._id] = false" :is="widgetEditorComponent(widget.type)" v-model="next[i]" :options="options.widgets[widget.type]" :type="widget.type" />
      <component :is="widgetComponent(widget.type)" v-model="next[i]" :options="options.widgets[widget.type]" :type="widget.type" />
      <ApostropheAddWidgetMenu @save="insert" :index="i + 1" :choices="choices" :widgetOptions="options.widgets" />
    </div>
  </div>
</template>

<script>

export default {
  name: 'ApostropheAreaEditor',
  props: {
    options: Object,
    items: Array,
    choices: Array
  },
  data() {
    return {
      next: this.items.slice(),
      editing: {}
    }
  },
  mounted() {
  },
  watch: {
    // Per rideron89 we must use a "deep" watcher because
    // we are interested in subproperties
    next: {
      deep: true,
      handler() {
        apos.bus.$emit('areaChanged', this.next);
      }
    }
  },
  methods: {
    up(i) {
      const previous = this.next[i - 1];
      this.next[i - 1] = this.next[i];
      this.next[i] = previous;
    },
    down(i) {
      const next = this.next[i + 1];
      this.next[i + 1] = this.next[i];
      this.next[i] = next;
    },
    remove(i) {
      this.next = this.next.slice(0, i).concat(this.next.slice(i + 1));
    },
    edit(i) {
      editing[this.next[i]._id] = !editing[this.next[i]._id];
    },
    insert($event) {
      this.next.splice($event.index, 0, $event.widget);
    },
    widgetComponent(type) {
      return this.moduleOptions.components.widgets[type];
    },
    widgetEditorComponent(type) {
      return this.moduleOptions.components.widgetEditors[type];
    }
  },
  computed: {
    moduleOptions() {
      return window.apos.areas;
    }
  }
};

</script>
