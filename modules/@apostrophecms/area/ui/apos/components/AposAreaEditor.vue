<template>
  <div :data-apos-area="areaId" class="apos-area">
    <div
      v-if="next.length === 0"
      class="apos-empty-area"
    >
      <template v-if="isEmptySingleton">
        <AposButton
          :label="'Add ' + contextMenuOptions.menu[0].label"
          type="primary"
          :icon="icon"
          @click="add(contextMenuOptions.menu[0].name)"
        />
      </template>
      <template v-else>
        <AposAreaMenu
          @insert="insert"
          :context-menu-options="contextMenuOptions"
          :empty="true"
          :index="0"
          :widget-options="options.widgets"
          :max-reached="maxReached"
        />
      </template>
    </div>
    <div class="apos-areas-widgets-list">
      <AposAreaWidget
        v-for="(widget, i) in next"
        :area-id="areaId"
        :key="widget._id"
        :widget="widget"
        :i="i"
        :options="options"
        :next="next"
        :doc-id="docId"
        :context-menu-options="contextMenuOptions"
        :field-id="fieldId"
        :widget-hovered="hoveredWidget"
        :widget-focused="focusedWidget"
        :max-reached="maxReached"
        @up="up"
        @down="down"
        @remove="remove"
        @edit="edit"
        @clone="clone"
        @update="update"
        @insert="insert"
      />
    </div>
  </div>
</template>

<script>

import Vue from 'apostrophe/vue';
import cuid from 'cuid';
import klona from 'klona';

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
    const validItems = this.items.filter(item => {
      if (!window.apos.modules[`${item.type}-widget`]) {
        console.warn(`The widget type ${item.type} exists in the content but is not configured.`);
      }
      return window.apos.modules[`${item.type}-widget`];
    });

    return {
      addWidgetEditor: null,
      addWidgetOptions: null,
      addWidgetType: null,
      areaId: cuid(),
      next: validItems,
      hoveredWidget: null,
      focusedWidget: null,
      contextMenuOptions: {
        menu: this.choices
      }
    };
  },
  computed: {
    isEmptySingleton() {
      return this.next.length === 0 &&
        this.options.widgets &&
        Object.keys(this.options.widgets).length === 1 &&
        this.options.max &&
        this.options.max === 1;
    },
    icon() {
      let icon = null;
      if (
        this.isEmptySingleton &&
        this.contextMenuOptions.menu[0] &&
        this.contextMenuOptions.menu[0].icon
      ) {
        icon = this.contextMenuOptions.menu[0].icon;
      }
      return icon;
    },
    moduleOptions() {
      return window.apos.area;
    },
    types() {
      return Object.keys(this.options.widgets);
    },
    maxReached() {
      return this.options.max && this.next.length >= this.options.max;
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
    apos.bus.$on('area-updated', this.areaUpdatedHandler);
    apos.bus.$on('widget-hover', this.updateWidgetHovered);
    apos.bus.$on('widget-focus', this.updateWidgetFocused);
    this.bindEventListeners();
  },
  beforeDestroy() {
    apos.bus.$off('area-updated', this.areaUpdatedHandler);
    apos.bus.$off('widget-hover', this.updateWidgetHovered);
    apos.bus.$off('widget-focus', this.updateWidgetFocused);
    this.unbindEventListeners();
  },
  methods: {
    bindEventListeners() {
      window.addEventListener('keydown', this.focusParentEvent);
    },
    unbindEventListeners() {
      window.removeEventListener('keydown', this.focusParentEvent);
    },
    areaUpdatedHandler(area) {
      for (const item of this.next) {
        if (this.patchSubobject(item, area)) {
          break;
        }
      }
    },
    focusParentEvent(event) {
      if (event.metaKey && event.keyCode === 8) {
        // meta + backspace
        apos.bus.$emit('widget-focus-parent', this.focusedWidget);
      }
    },
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
    async edit(i) {
      const widget = this.next[i];
      if (!this.widgetIsContextual(widget.type)) {
        const componentName = this.widgetEditorComponent(widget.type);
        const result = await apos.modal.execute(componentName, {
          value: widget,
          options: this.options.widgets[widget.type],
          type: widget.type,
          docId: this.docId
        });
        if (result) {
          return this.update(result);
        }
      }
    },
    clone(index) {
      const widget = klona(this.next[index]);
      delete widget._id;
      this.insert({
        widget,
        index
      });
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
    },
    async add(name) {
      if (this.widgetIsContextual(name)) {
        return this.insert({
          _id: cuid(),
          type: name,
          ...this.contextualWidgetDefaultData(name)
        });
      } else {
        const componentName = this.widgetEditorComponent(name);
        const result = await apos.modal.execute(componentName, {
          value: null,
          options: this.options.widgets[name],
          type: name,
          docId: this.docId
        });
        if (result) {
          await this.insert(result);
        }
      }
    },
    async insert(e) {
      let widget;
      if (e.widget) {
        widget = e.widget;
      }
      if (e.type) {
        // e IS a widget
        widget = e;
      }
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
    widgetIsContextual(type) {
      return this.moduleOptions.widgetIsContextual[type];
    },
    widgetEditorComponent(type) {
      return this.moduleOptions.components.widgetEditors[type];
    },
    // Recursively seek `subObject` within `object`, based on whether
    // its _id matches that of a sub-object of `object`. If found,
    // replace that sub-object with `subObject` and return `true`.
    patchSubobject(object, subObject) {
      let result;
      for (const [ key, val ] of Object.entries(object)) {
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

<style lang="scss" scoped>
.apos-empty-area {
  display: flex;
  padding: 30px;
  justify-content: center;
  align-items: center;
  flex-direction: column;
  min-height: 50px;
  background-color: var(--a-base-9);
  border: 1px solid var(--a-base-8);
  border-radius: var(--a-border-radius);
}

</style>
