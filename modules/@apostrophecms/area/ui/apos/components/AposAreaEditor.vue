<template>
  <div
    :data-apos-area="areaId"
    class="apos-area"
    :class="themeClass"
  >
    <div
      v-if="next.length === 0 && !foreign"
      class="apos-empty-area"
    >
      <template v-if="isEmptySingleton">
        <AposButton
          :label="'Add ' + contextMenuOptions.menu[0].label"
          :disabled="field && field.readOnly"
          type="primary"
          :icon="icon"
          @click="add({ index: 0, name: contextMenuOptions.menu[0].name })"
        />
      </template>
      <template v-else>
        <AposAreaMenu
          @add="add"
          :context-menu-options="contextMenuOptions"
          :empty="true"
          :index="0"
          :widget-options="options.widgets"
          :max-reached="maxReached"
          :disabled="field && field.readOnly"
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
        :rendering="rendering(widget)"
        @up="up"
        @down="down"
        @remove="remove"
        @edit="edit"
        @clone="clone"
        @update="update"
        @add="add"
      />
    </div>
  </div>
</template>

<script>
import cuid from 'cuid';
import { klona } from 'klona';
import AposThemeMixin from 'Modules/@apostrophecms/ui/mixins/AposThemeMixin';

export default {
  name: 'AposAreaEditor',
  mixins: [ AposThemeMixin ],
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
    field: {
      type: Object,
      default() {
        return {};
      }
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
    },
    renderings: {
      type: Object,
      default() {
        return {};
      }
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
      },
      edited: {}
    };
  },
  computed: {
    isEmptySingleton() {
      return this.next.length === 0 &&
        this.options.widgets &&
        Object.keys(this.options.widgets).length === 1 &&
        (this.options.max || this.field.max) &&
        (this.options.max === 1 || this.field.max === 1);
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
    },
    foreign() {
      // Cast to boolean is necessary to satisfy prop typing
      return !!(this.docId && (window.apos.adminBar.contextId !== this.docId));
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
      if (this.docId === window.apos.adminBar.contextId) {
        apos.bus.$emit('context-edited', {
          $move: {
            [`@${this.id}.items`]: {
              $item: this.next[i]._id,
              $before: this.next[i - 1]._id
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
      if (this.docId === window.apos.adminBar.contextId) {
        apos.bus.$emit('context-edited', {
          $move: {
            [`@${this.id}.items`]: {
              $item: this.next[i]._id,
              $after: this.next[i + 1]._id
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
      if (this.docId === window.apos.adminBar.contextId) {
        apos.bus.$emit('context-edited', {
          $pullAllById: {
            [`@${this.id}.items`]: [ this.next[i]._id ]
          }
        });
      }
      this.next = [
        ...this.next.slice(0, i),
        ...this.next.slice(i + 1)
      ];
    },
    async edit(i) {
      if (this.foreign) {
        try {
          const doc = await apos.http.get(
            `${window.apos.doc.action}/${this.docId}`,
            {
              busy: true
            }
          );
          if (doc._url) {
            const contextTitle = window.apos.adminBar.context.title;
            if (await apos.confirm({
              heading: `Leave ${contextTitle} to edit ${doc.title}?`,
              description: `The content you're trying to edit belongs to another document and must be edited there.\nChanges made to ${contextTitle} are saved automatically.`
            })) {
              location.assign(doc._url);
            }
          } else {
            apos.bus.$emit('admin-menu-click', {
              itemName: `${doc.type}:editor`,
              props: {
                docId: doc._id
              }
            });
          }
          return;
        } catch (e) {
          if (e.status === 404) {
            apos.notify('Not found.', { type: 'error' });
            return;
          } else {
            throw e;
          }
        }
      }

      const widget = this.next[i];

      if (!this.widgetIsContextual(widget.type)) {
        const componentName = this.widgetEditorComponent(widget.type);
        apos.area.activeEditor = this;
        const result = await apos.modal.execute(componentName, {
          value: widget,
          options: this.options.widgets[widget.type],
          type: widget.type,
          docId: this.docId
        });
        apos.area.activeEditor = null;
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
      if (this.docId === window.apos.adminBar.contextId) {
        apos.bus.$emit('context-edited', {
          [`@${widget._id}`]: widget
        });
      }
      const index = this.next.findIndex(w => w._id === widget._id);
      this.next = [
        ...this.next.slice(0, index),
        widget,
        ...this.next.slice(index + 1)
      ];
      this.edited[widget._id] = true;
    },
    // Add a widget into an area.
    async add({ index, name }) {
      if (this.widgetIsContextual(name)) {
        return this.insert({
          widget: {
            _id: cuid(),
            type: name,
            ...this.contextualWidgetDefaultData(name)
          },
          index
        });
      } else {
        const componentName = this.widgetEditorComponent(name);
        apos.area.activeEditor = this;
        const widget = await apos.modal.execute(componentName, {
          value: null,
          options: this.options.widgets[name],
          type: name,
          docId: this.docId
        });
        apos.area.activeEditor = null;
        if (widget) {
          await this.insert({
            widget,
            index
          });
        }
      }
    },
    contextualWidgetDefaultData(type) {
      return this.moduleOptions.contextualWidgetDefaultData[type];
    },
    async insert({ index, widget }) {
      if (!widget._id) {
        widget._id = cuid();
      }
      const push = {
        $each: [ widget ]
      };
      if (index < this.next.length) {
        push.$before = this.next[index]._id;
      }
      if (this.docId === window.apos.adminBar.contextId) {
        apos.bus.$emit('context-edited', {
          $push: {
            [`@${this.id}.items`]: push
          }
        });
      }
      this.next = [
        ...this.next.slice(0, index),
        widget,
        ...this.next.slice(index)
      ];
      if (this.widgetIsContextual(widget.type)) {
        this.edit(index);
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
        if (key.charAt(0) === '_') {
          // Patch only the thing itself, not a relationship that also contains
          // a copy
          continue;
        }
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
    },
    rendering(widget) {
      if (this.edited[widget._id]) {
        return null;
      } else {
        return this.renderings[widget._id];
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
