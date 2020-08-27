<template>
  <div class="apos-area">
    <AposAreaMenu
      @add="insert"
      :menu="choices"
      tip-alignment="left"
      :index="0"
      :widget-options="options.widgets"
      :doc-id="docId"
    />
    <div class="apos-areas-widgets-list">
      <div
        class="apos-area-widget-wrapper"
        v-for="(widget, i) in next"
        :key="widget._id"
      >
        <div class="apos-area-controls">
          <button v-if="i > 0" @click="up(i)">
            Up
          </button>
          <button v-if="i < next.length - 1" @click="down(i)">
            Down
          </button>
          <button @click="remove(i)">
            Remove
          </button>
          <button @click="edit(i)">
            Edit
          </button>
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
          :doc-id="docId"
          :id="widget._id"
          :area-field-id="fieldId"
          :value="widget"
          @edit="edit(i)"
        />
        <AposAreaMenu
          @add="insert"
          :menu="choices"
          tip-alignment="left"
          :index="i + 1"
          :widget-options="options.widgets"
          :doc-id="docId"
        />
      </div>
    </div>
  </div>
</template>

<script>

import Vue from 'apostrophe/vue';
import cuid from 'cuid';

export default {
  name: 'AposAreaEditor',
  props: {
    docId: {
      type: String,
      default: null
    },
    docType: {
      type: String,
      default: null
    },
    id: {
      type: String,
      required: true
    },
    fieldId: {
      type: String,
      required: true
    },
    options: {
      type: Object,
      default() {
        return {};
      }
    },
    items: {
      type: Array,
      default() {
        return [];
      }
    },
    choices: {
      type: Array,
      required: true
    }
  },
  emits: [ 'changed' ],
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
        // For the benefit of AposInputArea which is the
        // direct parent when we are not editing on-page
        this.$emit('changed', {
          items: this.next
        });
      } else {
        // For the benefit of all other area editors on-page
        // which may have this one as a sub-area in some way, and
        // mistakenly think they know its contents have not changed
        apos.bus.$emit('area-updated', {
          _id: this.id,
          items: this.next
        });
      }
    }
  },
  mounted() {
    if (this.docId) {
      this.areaUpdatedHandler = (area) => {
        let patched = false;
        for (const item of this.next) {
          if (this.patchSubobject(item, area)) {
            patched = true;
            break;
          }
        }
        if (patched) {
          // Make sure our knowledge of the change is reflected
          // everywhere via a refresh
          this.next = this.next.slice();
        }
      };
      apos.bus.$on('area-updated', this.areaUpdatedHandler);
    }
  },
  beforeDestroy() {
    if (this.areaUpdatedHandler) {
      apos.bus.$off('area-updated', this.areaUpdatedHandler);
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
    },
    // Recursively seek `subObject` within `object`, based on whether
    // its _id matches that of a sub-object of `object`. If found,
    // replace that sub-object with `subObject` and return `true`.
    patchSubobject(object, subObject) {
      let key;
      let val;
      let result;
      for (key in object) {
        val = object[key];
        if (val && typeof val === 'object') {
          if (val._id === subObject._id) {
            object[key] = subObject;
            return true;
          }
          result = this.patchSubobject(val, subObject);
          if (result) {
            return result;
          }
        }
      }
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
