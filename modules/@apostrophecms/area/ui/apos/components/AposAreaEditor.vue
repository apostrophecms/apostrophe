<template>
  <div :data-apos-area="areaId" class="apos-area">
    <div
      v-if="next.length === 0"
      class="apos-empty-area"
    >
      <AposEmptyState :empty-state="emptyState" />
      <AposAreaMenu
        @add="insert"
        :context-options="contextOptions"
        :empty="true"
        :index="0"
        :widget-options="options.widgets"
      />
    </div>
    <div class="apos-areas-widgets-list">
      <AposAreaWidget
        v-for="(widget, i) in next"
        :area-id="areaId"
        :key="widget._id"
        :widget="widget"
        :i="i"
        :options="options"
        :editing="editing"
        :next="next"
        :doc-id="docId"
        :context-options="contextOptions"
        :field-id="fieldId"
        :widget-hovered="hoveredWidget"
        :widget-focused="focusedWidget"
        @up="up"
        @down="down"
        @remove="remove"
        @edit="edit"
        @update="update"
        @insert="insert"
      />
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
      areaId: cuid(),
      next: this.items,
      editing: {},
      hoveredWidget: null,
      focusedWidget: null,
      contextOptions: {
        autoPosition: false,
        menu: this.choices
      },
      emptyState: {
        message: 'Add your content here'
      }
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
      apos.bus.$on('widget-hover', this.updateWidgetHovered);
      apos.bus.$on('widget-focus', this.updateWidgetFocused);
    }
  },
  beforeDestroy() {
    if (this.areaUpdatedHandler) {
      apos.bus.$off('area-updated', this.areaUpdatedHandler);
      apos.bus.$on('widget-hover', this.updateWidgetHovered);
      apos.bus.$on('widget-focus', this.updateWidgetFocused);
    }
  },
  methods: {
    updateWidgetHovered(widgetId) {
      this.hoveredWidget = widgetId;
    },
    updateWidgetFocused(widgetId) {
      this.focusedWidget = widgetId;
      
    },
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
    // // Implementation detail, you want to modify `onChildAreaEvent`, below
    // areaEventReceiver(area, ...args) {
    //   if (apos.util.closest(area.$el.parentNode, '[data-apos-area]') === this.$el) {
    //     const $widget = apos.util.closest(area.$el, '[data-apos-widget]');
    //     console.log($widget);
    //     console.log(this.next);
    //     const widget = this.next.find(widget => widget._id === $widget.getAttribute('id'));
    //     console.log(widget);
    //     this.onChildAreaEvent(area, widget, ...args);
    //   } else {
    //     console.log('received, but not for us');
    //   }
    // },
    // // Emit an event from this area to its parent area, even though they
    // // are in separate Vue apps. Results in a call to onAreaEvent in the
    // // parent area, and only that area.
    // //
    // // You must pass a name argument, to distinguish your different
    // // child area events, and you may pass more arguments.
    // emitToParentArea(name, ...args) {
    //   apos.bus.$emit('area-event', this, name, ...args);
    // },
    // // Receive an event from a child area, even though they are in
    // // separate Vue apps. inWidget is the widget within this.next in which
    // // childArea is nested. All incoming arguments after `name` wind up in the
    // // `args` array.
    // onChildAreaEvent(childArea, inWidget, name, ...args) {
    //   console.log('The descendant area', childArea, 'nested directly in our child widget', inWidget, 'emitted a ', name, ' event with these arguments:', args);
    // }
  }
};

</script>

<style lang="scss" scoped>
.apos-empty-area {
  display: flex;
  padding: 30px;
  justify-content: center;
  align-items: center;
  flex-direction: column;
  min-height: 50px;
  background-color: var(--a-base-10);
  border: 2px dotted var(--a-primary);
}

.apos-area-widget-wrapper {
  position: relative;
}
</style>
