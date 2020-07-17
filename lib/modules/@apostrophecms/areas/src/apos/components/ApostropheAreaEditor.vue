<template>
  <div class="apos-area">
    <ApostropheAddWidgetMenu @widgetAdded="insert" :index="0" :choices="choices" :widgetOptions="options.widgets" :_docId="_docId" />
    <div class="apos-areas-widgets-list">
      <div class="apos-area-widget-wrapper" v-for="(wrapped, i) in next" :key="wrapped.widget._id">
        <div class="apos-area-controls">
          <button v-if="i > 0" @click="up(i)">Up</button>
          <button v-if="i < next.length - 1" @click="down(i)">Down</button>
          <button @click="remove(i)">Remove</button>
          <button @click="edit(i)">Edit</button>
        </div>
        <component v-if="editing[wrapped.widget._id]" @save="editing[wrapped.widget._id] = false" @close="editing[wrapped.widget._id] = false" :is="widgetEditorComponent(wrapped.widget.type)" v-model="wrapped.widget" :options="options.widgets[wrapped.widget.type]" :type="wrapped.widget.type" :_docId="_docId" :_id="wrapped.widget._id" />
        <component v-if="(!editing[wrapped.widget._id]) || (!widgetIsContextual(wrapped.widget.type))" :is="widgetComponent(wrapped.widget.type)" :options="options.widgets[wrapped.widget.type]" :type="wrapped.widget.type" :_docId="_docId" :_id="wrapped.widget._id" :areaFieldId="fieldId" :value="wrapped.widget" @edit="edit(i)" />
        <ApostropheAddWidgetMenu @widgetAdded="insert" :index="i + 1" :choices="choices" :widgetOptions="options.widgets" :_docId="_docId" />
      </div>
    </div>
  </div>
</template>

<script>

import Vue from 'apostrophe/vue';

export default {
  name: 'ApostropheAreaEditor',
  props: {
    _docId: String,
    docType: String,
    _id: String,
    fieldId: String,
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
  methods: {
    async up(i) {
      await apos.http.patch(`${apos.docs.action}/${this._docId}`, {
        busy: true,
        body: {
          $move: {
            [`@${this._id}.items`]: {
              $item: this.next[i].widget._id,
              $before: this.next[i - 1].widget._id
            }
          }
        }
      });
      const temp = this.next[i - 1];
      Vue.set(this.next, i - 1, this.next[i]);
      Vue.set(this.next, i, temp);
    },
    async down(i) {
      await apos.http.patch(`${apos.docs.action}/${this._docId}`, {
        busy: true,
        body: {
          $move: {
            [`@${this._id}.items`]: {
              $item: this.next[i].widget._id,
              $after: this.next[i + 1].widget._id
            }
          }
        }
      });
      const temp = this.next[i + 1];
      Vue.set(this.next, i + 1, this.next[i]);
      Vue.set(this.next, i, temp);
    },
    async remove(i) {
      await apos.http.patch(`${apos.docs.action}/${this._docId}`, {
        busy: true,
        body: {
          $pullAllById: {
            [`@${this._id}.items`]: [ this.next[i].widget._id ]
          }
        }
      });
      this.next = this.next.slice(0, i).concat(this.next.slice(i + 1));
    },
    edit(i) {
      Vue.set(this.editing, this.next[i].widget._id, !this.editing[this.next[i].widget._id]);
    },
    async insert($event) {
      if (!$event.widget._id) {
        $event.widget._id = cuid();
      }
      const push = {
        $each: [ $event.widget ]
      };
      if ($event.index < this.next.length) {
        push.$before = this.next[$event.index].widget._id;
      }
      await apos.http.patch(`${apos.docs.action}/${this._docId}`, {
        busy: true,
        body: {
          $push: {
            [`@${this._id}.items`]: push
          }
        }
      });
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
