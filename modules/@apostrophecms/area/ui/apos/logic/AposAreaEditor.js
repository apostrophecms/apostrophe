import { createId } from '@paralleldrive/cuid2';
import { mapState, mapActions } from 'pinia';
import AposThemeMixin from 'Modules/@apostrophecms/ui/mixins/AposThemeMixin';
import newInstance from 'apostrophe/modules/@apostrophecms/schema/lib/newInstance.js';
import cloneWidget from 'Modules/@apostrophecms/area/lib/clone-widget.js';
import { useWidgetStore } from 'Modules/@apostrophecms/ui/stores/widget';

export default {
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
    meta: {
      type: Object,
      default() {
        return {};
      }
    },
    followingValues: {
      type: Object,
      default() {
        return {};
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
    },
    generation: {
      type: Number,
      required: false,
      default() {
        return null;
      }
    }
  },
  emits: [ 'changed' ],
  data() {
    return {
      addWidgetEditor: null,
      addWidgetOptions: null,
      addWidgetType: null,
      areaId: createId(),
      next: this.getValidItems(),
      hoveredNonForeignWidget: null,
      contextMenuOptions: {
        menu: this.choices
      },
      edited: {},
      widgets: {}
    };
  },
  computed: {
    ...mapState(useWidgetStore, [ 'focusedWidget', 'hoveredWidget', 'focusedArea' ]),
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
      return Object.keys(this.widgets);
    },
    maxReached() {
      return this.options.max && this.next.length >= this.options.max;
    },
    foreign() {
      // Cast to boolean is necessary to satisfy prop typing
      return !!(this.docId && (window.apos.adminBar.contextId !== this.docId));
    },
    focusedWidgetIndex() {
      if (!this.focusedWidget) {
        return -1;
      }

      return this.next.findIndex(widget => widget._id === this.focusedWidget);
    }
  },
  watch: {
    // Note: please don't make this a deep watcher as that could cause
    // issues with live widget preview and also performance, the top level
    // array will change in situations where a patch API call is actually
    // needed at this level
    next() {
      if (!this.docId) {
        // For the benefit of AposInputArea which is the
        // direct parent when we are not editing on-page
        this.$emit('changed', {
          items: this.next
        });
      }
      // For the benefit of all other area editors on-page
      // which may have this one as a sub-area in some way, and
      // mistakenly think they know its contents have not changed
      apos.bus.$emit('area-updated', {
        _id: this.id,
        items: this.next
      });
    },
    generation() {
      this.next = this.getValidItems();
    }
  },
  created() {
    if (this.options.groups) {
      for (const group of Object.keys(this.options.groups)) {
        this.widgets = {
          ...this.options.groups[group].widgets,
          ...this.widgets
        };
      }
    }
  },
  mounted() {
    this.bindEventListeners();
  },
  beforeUnmount() {
    this.unbindEventListeners();
  },
  methods: {
    ...mapActions(useWidgetStore, [ 'setFocusedArea', 'setFocusedWidget' ]),
    bindEventListeners() {
      apos.bus.$on('area-updated', this.areaUpdatedHandler);
      apos.bus.$on('command-menu-area-copy-widget', this.handleCopy);
      apos.bus.$on('command-menu-area-cut-widget', this.handleCut);
      apos.bus.$on('command-menu-area-duplicate-widget', this.handleDuplicate);
      apos.bus.$on('command-menu-area-paste-widget', this.handlePaste);
      apos.bus.$on('command-menu-area-remove-widget', this.handleRemove);
      window.addEventListener('keydown', this.focusParentEvent);
    },
    unbindEventListeners() {
      apos.bus.$off('area-updated', this.areaUpdatedHandler);
      apos.bus.$off('command-menu-area-copy-widget', this.handleCopy);
      apos.bus.$off('command-menu-area-cut-widget', this.handleCut);
      apos.bus.$off('command-menu-area-duplicate-widget', this.handleDuplicate);
      apos.bus.$off('command-menu-area-paste-widget', this.handlePaste);
      apos.bus.$off('command-menu-area-remove-widget', this.handleRemove);
      window.removeEventListener('keydown', this.focusParentEvent);
    },
    isInsideContentEditable() {
      return document.activeElement.closest('[contenteditable]') !== null;
    },
    isInsideFocusedArea() {
      return this.focusedArea === this.areaId;
    },
    resetFocusedArea() {
      if (this.focusedArea !== this.areaId) {
        return;
      }

      this.setFocusedArea(null);
    },
    handleCopy() {
      if (
        !this.isInsideFocusedArea() ||
        this.isInsideContentEditable() ||
        this.focusedWidgetIndex === -1
      ) {
        return;
      }

      this.copy({ index: this.focusedWidgetIndex });
    },
    handleCut() {
      if (
        !this.isInsideFocusedArea() ||
        this.isInsideContentEditable() ||
        this.focusedWidgetIndex === -1
      ) {
        return;
      }

      this.cut({ index: this.focusedWidgetIndex });
    },
    handleDuplicate() {
      if (
        !this.isInsideFocusedArea() ||
        this.isInsideContentEditable() ||
        this.focusedWidgetIndex === -1
      ) {
        return;
      }

      this.clone({ index: this.focusedWidgetIndex });
    },
    handlePaste() {
      if (
        !this.isInsideFocusedArea() ||
        this.isInsideContentEditable() ||
        (this.focusedWidgetIndex === -1 && this.next.length > 0)
      ) {
        return;
      }

      this.paste({ index: Math.max(this.focusedWidgetIndex, 0) });
    },
    handleRemove() {
      if (
        !this.isInsideFocusedArea() ||
        this.isInsideContentEditable() ||
        this.focusedWidgetIndex === -1
      ) {
        return;
      }

      this.remove({ index: this.focusedWidgetIndex });
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
    async up({ index }) {
      if (this.docId === window.apos.adminBar.contextId) {
        apos.bus.$emit('context-edited', {
          $move: {
            [`@${this.id}.items`]: {
              $item: this.next[index]._id,
              $before: this.next[index - 1]._id
            }
          }
        });
      }
      this.next = [
        ...this.next.slice(0, index - 1),
        this.next[index],
        this.next[index - 1],
        ...this.next.slice(index + 1)
      ];
    },
    async down({ index }) {
      if (this.docId === window.apos.adminBar.contextId) {
        apos.bus.$emit('context-edited', {
          $move: {
            [`@${this.id}.items`]: {
              $item: this.next[index]._id,
              $after: this.next[index + 1]._id
            }
          }
        });
      }
      this.next = [
        ...this.next.slice(0, index),
        this.next[index + 1],
        this.next[index],
        ...this.next.slice(index + 2)
      ];
    },
    async remove({ index }, { autosave = true } = {}) {
      if (autosave && (this.docId === window.apos.adminBar.contextId)) {
        apos.bus.$emit('context-edited', {
          $pullAllById: {
            [`@${this.id}.items`]: [ this.next[index]._id ]
          }
        });
      }
      this.next = [
        ...this.next.slice(0, index),
        ...this.next.slice(index + 1)
      ];

      const focusNext = this.next[index - 1] || this.next[index];

      if (focusNext) {
        this.setFocusedWidget(focusNext._id, this.areaId, { scrollTo: true });
      }
    },
    async cut({ index }) {
      apos.area.widgetClipboard.set(this.next[index]);
      await this.remove({ index });
      apos.notify('Widget cut to clipboard', {
        type: 'success',
        icon: 'content-cut-icon',
        dismiss: true
      });
    },
    async copy({ index }) {
      apos.area.widgetClipboard.set(this.next[index]);
      apos.notify('Widget copied to clipboard', {
        type: 'success',
        icon: 'content-copy-icon',
        dismiss: true
      });
    },
    async edit({ index }) {
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
              heading: this.$t('apostrophe:leavePageHeading', {
                oldTitle: contextTitle,
                newTitle: doc.title
              }),
              description: this.$t('apostrophe:leavePageDescription', {
                oldTitle: contextTitle
              }),
              localize: false
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
            apos.notify('apostrophe:notFound', { type: 'error' });
            return;
          } else {
            throw e;
          }
        }
      }

      const widget = this.next[index];

      if (!this.widgetIsContextual(widget.type)) {
        const componentName = this.widgetEditorComponent(widget.type);
        apos.area.activeEditor = this;
        apos.bus.$on('apos-refreshing', cancelRefresh);
        const preview = this.widgetPreview(widget.type, index, false);
        const result = await apos.modal.execute(componentName, {
          modelValue: widget,
          options: this.widgetOptionsByType(widget.type),
          type: widget.type,
          docId: this.docId,
          parentFollowingValues: this.followingValues,
          areaFieldId: this.fieldId,
          meta: this.meta[widget._id]?.aposMeta,
          preview
        });
        apos.area.activeEditor = null;
        apos.bus.$off('apos-refreshing', cancelRefresh);
        if (result) {
          return this.update(result);
        }
      }
    },
    clone({ index }) {
      const widget = cloneWidget(this.next[index]);
      this.insert({
        widget,
        index: index + 1
      });
    },
    async paste({ index }) {
      const clipboard = apos.area.widgetClipboard.get();
      if (clipboard) {
        const widget = clipboard;
        const allowed = this.contextMenuOptions.menu.find(
          option => option.name === widget.type
        );
        if (allowed) {
          this.add({
            index,
            clipboard
          });
        }
      }
    },
    async update(updated, { autosave = true, reverting = false } = {}) {
      if (!reverting) {
        updated.aposPlaceholder = false;
      }
      if (!updated.metaType) {
        updated.metaType = 'widget';
      }
      if (autosave && (this.docId === window.apos.adminBar.contextId)) {
        apos.bus.$emit('context-edited', {
          [`@${updated._id}`]: updated
        });
      }

      this.next = this.next.map((widget) => {
        if (widget._id === updated._id) {
          return updated;
        }
        return widget;
      });
      this.edited[updated._id] = true;
    },
    // Add a widget into an area. index is required, along
    // with one and only one of name, widget or clipboard.
    // If widget is passed it is inserted directly. If
    // clipboard is passed it is cloned and inserted.
    async add({
      index,
      name,
      widget,
      clipboard
    }) {
      if (clipboard) {
        clipboard = cloneWidget(clipboard);
        return this.insert({
          widget: clipboard,
          index
        });
      }
      if (widget) {
        return this.insert({
          widget,
          index
        });
      }
      if (this.widgetIsContextual(name)) {
        return this.insert({
          widget: {
            type: name,
            ...this.contextualWidgetDefaultData(name),
            aposPlaceholder: this.widgetHasPlaceholder(name)
          },
          index
        });
      }
      if (!this.widgetHasInitialModal(name)) {
        const newWidget = this.newWidget(name);
        return this.insert({
          widget: {
            ...newWidget,
            aposPlaceholder: this.widgetHasPlaceholder(name)
          },
          index
        });
      }

      const componentName = this.widgetEditorComponent(name);
      apos.area.activeEditor = this;
      const preview = this.widgetPreview(name, index, true);
      const newWidget = await apos.modal.execute(componentName, {
        modelValue: null,
        options: this.widgetOptionsByType(name),
        type: name,
        docId: this.docId,
        areaFieldId: this.fieldId,
        parentFollowingValues: this.followingValues,
        preview
      });
      apos.area.activeEditor = null;
      if (newWidget) {
        return this.insert({
          widget: newWidget,
          index
        });
      }
    },
    widgetOptionsByType(name) {
      if (this.options.widgets) {
        return this.options.widgets[name];
      } else if (this.options.expanded) {
        for (const info of Object.values(this.options.groups || {})) {
          if (info?.widgets?.[name]) {
            return info.widgets[name];
          }
        }
      }
      return null;
    },
    contextualWidgetDefaultData(type) {
      return this.moduleOptions.contextualWidgetDefaultData[type];
    },
    async insert({
      index, widget, autosave = true
    } = {}) {
      if (!widget._id) {
        widget._id = createId();
      }
      if (!widget.metaType) {
        widget.metaType = 'widget';
      }
      if (autosave && (this.docId === window.apos.adminBar.contextId)) {
        const push = {
          $each: [ widget ]
        };
        if (index < this.next.length) {
          push.$before = this.next[index]._id;
        }
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
        this.edit({ index });
      }
      this.setFocusedWidget(widget._id, this.areaId, { scrollTo: true });
    },
    widgetIsContextual(type) {
      return this.moduleOptions.widgetIsContextual[type];
    },
    widgetHasPlaceholder(type) {
      return this.moduleOptions.widgetHasPlaceholder[type];
    },
    widgetHasInitialModal(type) {
      return this.moduleOptions.widgetHasInitialModal[type];
    },
    widgetEditorComponent(type) {
      return this.moduleOptions.components.widgetEditors[type];
    },
    widgetPreview(type, index, create) {
      return this.moduleOptions.widgetPreview[type]
        ? {
          area: this,
          index,
          create
        }
        : null;
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
    },

    getValidItems() {
      return this.items.filter(item => {
        if (!window.apos.modules[`${item.type}-widget`]) {
          // eslint-disable-next-line no-console
          console.warn(`The widget type ${item.type} exists in the content but is not configured.`);
        }
        return window.apos.modules[`${item.type}-widget`];
      });
    },
    // Return a new widget object in which defaults are fully populated,
    // especially valid sub-area objects, so that nested edits work on the page
    newWidget(type) {
      const schema = apos.modules[apos.area.widgetManagers[type]].schema;
      const widget = {
        ...newInstance(schema),
        type
      };
      return widget;
    }
  }
};

function cancelRefresh(refreshOptions) {
  refreshOptions.refresh = false;
}
