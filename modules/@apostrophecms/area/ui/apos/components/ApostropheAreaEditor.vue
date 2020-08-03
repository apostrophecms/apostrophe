<template>
  <div class="apos-area">
    <ApostropheAddWidgetMenu @widgetAdded="insert" :index="0" :choices="choices" :widgetOptions="options.widgets" :docId="docId" />
    <div class="apos-areas-widgets-list">
      <div class="apos-area-widget-wrapper" v-for="(widget, i) in next" :key="widget._id">
        <div class="apos-area-controls">
          <button v-if="i > 0" @click="up(i)">Up</button>
          <button v-if="i < next.length - 1" @click="down(i)">Down</button>
          <button @click="remove(i)">Remove</button>
          <button @click="edit(i)">Edit</button>
        </div>
        <component v-if="editing[widget._id]" @save="editing[widget._id] = false" @close="editing[widget._id] = false" :is="widgetEditorComponent(widget.type)" :value="widget" @update="update" :options="options.widgets[widget.type]" :type="widget.type" :docId="docId" />
        <component v-if="(!editing[widget._id]) || (!widgetIsContextual(widget.type))" :is="widgetComponent(widget.type)" :options="options.widgets[widget.type]" :type="widget.type" :docId="docId" :id="widget._id" :areaFieldId="fieldId" :value="widget" @edit="edit(i)" />
        <ApostropheAddWidgetMenu @widgetAdded="insert" :index="i + 1" :choices="choices" :widgetOptions="options.widgets" :docId="docId" />
      </div>
    </div>
  </div>
</template>

<script>

import Vue from 'apostrophe/vue';
import cuid from 'cuid';

export default {
  name: 'ApostropheAreaEditor',
  props: {
    docId: String,
    docType: String,
    id: String,
    fieldId: String,
    options: Object,
    items: Array,
    choices: Array
  },
  data() {
    return {
      next: this.items,
      editing: {}
    };
  },
  computed: {
    moduleOptions() {
      return window.apos.area;
    },
    types() {
      return Object.keys(this.options.widgets);
    }
  },
  watch: {
    next() {
      if (!this.docId) {
        this.$emit('changed', {
          items: this.next
        });
      }
    }
  },
  methods: {
    async up(i) {
      if (this.docId) {
        await apos.http.patch(`${apos.doc.action}/${this.docId}`, {
          busy: true,
          body: {
            $move: {
              [`@${this.id}.items`]: {
                $item: this.next[i]._id,
                $before: this.next[i - 1]._id
              }
            }
          }
        });
      }
      this.next = [
        ...this.next.slice(0, i - 1),
        this.next[i],
        this.next[i - 1],
        ...this.next.slice(i + 1)
      ];
    },
    async down(i) {
      if (this.docId) {
        await apos.http.patch(`${apos.doc.action}/${this.docId}`, {
          busy: true,
          body: {
            $move: {
              [`@${this.id}.items`]: {
                $item: this.next[i]._id,
                $after: this.next[i + 1]._id
              }
            }
          }
        });
      }
      this.next = [
        ...this.next.slice(0, i),
        this.next[i + 1],
        this.next[i],
        ...this.next.slice(i + 2)
      ];
    },
    async remove(i) {
      if (this.docId) {
        await apos.http.patch(`${apos.doc.action}/${this.docId}`, {
          busy: true,
          body: {
            $pullAllById: {
              [`@${this.id}.items`]: [ this.next[i]._id ]
            }
          }
        });
      }
      this.next = [
        ...this.next.slice(0, i),
        ...this.next.slice(i + 1)
      ];
    },
    edit(i) {
      Vue.set(this.editing, this.next[i]._id, !this.editing[this.next[i]._id]);
    },
    async update(widget) {
      if (this.docId) {
        await apos.http.patch(`${apos.doc.action}/${this.docId}`, {
          busy: 'contextual',
          body: {
            [`@${widget._id}`]: widget
          }
        });
      }
      const index = this.next.findIndex(w => w._id === widget._id);
      this.next = [
        ...this.next.slice(0, index),
        widget,
        ...this.next.slice(index + 1)
      ];
      if (!this.widgetIsContextual(widget.type)) {
        this.editing[widget._id] = false;
      }
    },
    async insert(e) {
      const widget = e.widget;
      if (!widget._id) {
        widget._id = cuid();
      }
      const push = {
        $each: [ widget ]
      };
      if (e.index < this.next.length) {
        push.$before = this.next[e.index]._id;
      }
      if (this.docId) {
        await apos.http.patch(`${apos.doc.action}/${this.docId}`, {
          busy: true,
          body: {
            $push: {
              [`@${this.id}.items`]: push
            }
          }
        });
      }
      this.next = [
        ...this.next.slice(0, e.index),
        widget,
        ...this.next.slice(e.index)
      ];
      if (this.widgetIsContextual(widget.type)) {
        this.edit(e.index);
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
    }
  }
};

</script>


<style>
.apos-area {
  margin: 5px;
  padding: 5px;
  border: 2px solid var(--a-brand-green);
}
.apos-areas-widgets-list {
  min-height: 64px;
}
</style>
