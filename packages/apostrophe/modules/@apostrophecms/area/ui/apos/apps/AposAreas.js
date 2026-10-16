
import createApp, { pinia } from 'Modules/@apostrophecms/ui/lib/vue';
import { useWidgetGraphStore } from 'Modules/@apostrophecms/ui/stores/widgetGraph.js';
import { useWidgetStore } from 'Modules/@apostrophecms/ui/stores/widget.js';
import { nextTick } from 'vue';
import { createId } from 'apostrophe/lib/beneath.js';
import applyPatch from 'Modules/@apostrophecms/area/lib/apply-patch.js';
import { addCapturedWidgets } from 'Modules/@apostrophecms/area/lib/widget-selection.js';
import {
  isEditingContext,
  parentWidgetId,
  widgetContext,
  widgetIdsInRect
} from 'Modules/@apostrophecms/area/lib/widget-selection-dom.js';

export default function() {
  const mountedApps = new Map();
  let widgetsRendering = 0;
  apos.area.widgetOptions = [];

  createWidgetClipboardApp();

  createSelectionToolbar();

  createMarqueeSelect();
  watchEditMode();

  createAreaApps();

  document.documentElement.style.setProperty('--a-widget-margin', apos.ui.widgetMargin);

  apos.bus.$on('widget-rendering', function() {
    widgetsRendering++;
  });

  apos.bus.$on('widget-rendered', options => {
    widgetsRendering--;
    createAreaAppsAndRunPlayersIfDone(options);
  });

  apos.bus.$on('refreshed', function() {
    // Re-instantiate the on-page widget graph before remounting areas.
    // The normal mounted hooks will rebuild it from fresh data.
    const graphStore = useWidgetGraphStore(pinia);
    if (apos.adminBar?.contextId) {
      graphStore.resetGraph(apos.adminBar.contextId);
    }
    createAreaAppsAndRunPlayersIfDone();
  });

  function createAreaAppsAndRunPlayersIfDone({ edit = true, el = null } = {}) {
    if (edit) {
      createAreaApps(el);
      nextTick(() => {
        cleanupOrphanedApps();
      });
    }
    if (widgetsRendering === 0) {
      apos.util.runPlayers();
    }
  }

  function createAreaApps(el) {
    // Create apps only for the areas at the top of the nesting
    // hierarchy in the given context. widget-rendered events will
    // cause more invocations later, avoiding double invocations,
    // orphaned apps and wasted time. -Tom
    const els = Array.from((el || document).querySelectorAll('[data-apos-area-newly-editable]'));
    const lowest = Math.min(...els.map(el => depth(el)));
    els.filter(el => depth(el) === lowest).forEach(el => createAreaApp(el));
  }

  // Determine how deeply it is nested in other areas. We don't care about
  // non-area levels
  function depth(el) {
    let depth = 0;
    while (el) {
      el = el.parentNode;
      if (el?.hasAttribute) {
        if (el.hasAttribute('data-apos-area-newly-editable') || el.hasAttribute('data-apos-area-editable')) {
          depth++;
        }
      }
    }
    return depth;
  }

  function createAreaApp(el) {
    const options = JSON.parse(el.getAttribute('data-options')) || {};
    const data = JSON.parse(el.getAttribute('data')) || {};
    const fieldId = el.getAttribute('data-field-id');
    const moduleName = el.getAttribute('data-module');
    const choices = JSON.parse(el.getAttribute('data-choices'));
    const renderings = {};
    const _docId = data._docId;

    const parentOptionsStr = el.getAttribute('data-parent-options');
    const parentOptions = parentOptionsStr ? JSON.parse(parentOptionsStr) : null;

    let componentName = options.editorComponent || 'AposAreaEditor';
    if (!apos.vueComponents[componentName]) {
      // eslint-disable-next-line no-console
      console.error(`Area Editor component "${componentName}" not found. Switching to default.`);
      componentName = 'AposAreaEditor';
    }
    const component = apos.vueComponents[componentName];

    for (const widgetEl of el.querySelectorAll('[data-apos-widget]')) {
      const _id = widgetEl.getAttribute('data-apos-widget');
      const item = data.items.find(item => _id === item._id);
      // This will only match our own widgets, leaving the nested matches alone,
      // another area app will handle them when the time comes
      if (item) {
        renderings[_id] = {
          html: widgetEl.innerHTML,
          parameters: {
            _docId,
            widget: item,
            areaFieldId: fieldId,
            type: item.type
          }
        };
        widgetEl.remove();
      }
    }
    el.removeAttribute('data-apos-area-newly-editable');
    el.setAttribute('data-apos-area-editable', true);

    let created = false;
    let observer;

    if (apos.area.activeEditor && (apos.area.activeEditor.id === data._id)) {
      // Editing a piece causes a refresh of the main content area,
      // but this may contain the area we originally intended to add
      // a widget to when we created a piece for that purpose. Preserve
      // the editing experience by restoring that widget's editor to the DOM
      // rather than creating a new one.

      el.parentNode.replaceChild(apos.area.activeEditor.$el, el);
    } else {
      const rect = el.getBoundingClientRect();
      const isInViewport = rect.bottom >= 0 &&
        rect.top <= window.innerHeight;

      if (isInViewport) {
        mountApp();
      } else {
        observer = new IntersectionObserver(observed, {
          rootMargin: '600px'
        });
        observer.observe(el);
        apos.bus.$on('context-history-apply', applyWhilePending);
      }
    }

    // Undo and redo leave the rest of the page as it is, rather than
    // rendering it again, so an area still waiting to be mounted would
    // otherwise come up showing the page as it was when it loaded
    function applyWhilePending(event) {
      if (!document.body.contains(el)) {
        apos.bus.$off('context-history-apply', applyWhilePending);
        return;
      }
      if (_docId !== apos.adminBar?.contextId) {
        return;
      }
      const result = applyPatch(data._id, data.items, event.patch, {
        deep: true
      });
      if (!result) {
        return;
      }
      data.items = result.items;
      for (const id of result.changed) {
        delete renderings[id];
      }
      for (const widget of (result.removed || [])) {
        event.removed.push(widget);
      }
      // An area editor holding the widget we are nested in keeps a copy
      apos.bus.$emit('area-updated', {
        _id: data._id,
        items: data.items
      });
      event.claim();
    }

    // The newest entry: a scroll right after `observe` arrives in the same
    // callback as the first report, which still says the area is out of view
    function observed(entries) {
      const intersects = entries.at(-1).isIntersecting;
      if (!intersects) {
        return;
      }
      if (created) {
        observer.disconnect();
        return;
      }
      mountApp();
      observer.disconnect();
    }

    function mountApp() {
      apos.bus.$off('context-history-apply', applyWhilePending);
      const app = createApp(component, {
        options,
        id: data._id,
        items: data.items,
        choices,
        docId: _docId,
        fieldId,
        moduleName,
        parentOptions,
        renderings
      });

      // Resolve graphKey: if this area is inside a modal that owns a
      // graph (data-apos-graph-key), use that key.  Otherwise fall back
      // to the on-page contextId.  This single DOM lookup bridges the
      // provide/inject gap created by createApp.
      const graphKey = el.closest('[data-apos-graph-key]')
        ?.getAttribute('data-apos-graph-key') || apos.adminBar?.contextId || null;
      // Provide the resolved graphKey so every descendant component
      // can simply inject('aposGraphKey') and get the correct value.
      if (graphKey) {
        app.provide('aposGraphKey', graphKey);
      }
      app.mount(el);
      mountedApps.set(el, app);
      created = true;
    }
  }

  function createSelectionToolbar() {
    const component = apos.vueComponents.AposWidgetSelectionToolbar;
    if (!component) {
      return;
    }
    const el = document.createElement('div');
    document.body.appendChild(el);
    createApp(component).mount(el);
  }

  function watchEditMode() {
    apos.bus.$on('admin-bar-edit-mode', (editing) => {
      if (editing) {
        return;
      }
      const store = useWidgetStore(pinia);
      const el = widgetContext(store.focusedWidget)?.el;
      if (el?.closest('.apos-modal, [data-apos-schema-area]')) {
        return;
      }
      if (store.selectedWidgetIds?.length) {
        store.setFocusedWidget(null);
      }
    });
  }

  // Meta-drag (or ctrl-drag) draws a rectangle and adds every widget it
  // touches. While the rectangle is on screen the selection previews the
  // net, including widgets that leave it. A drag that stays under a few
  // pixels remains a meta-click.
  function createMarqueeSelect() {
    const threshold = 4;
    let drag = null;
    let box = null;
    let previewFrame = 0;
    let swallowClick = false;

    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('selectstart', onSelectStart);
    // An image or link starts a native drag within a few pixels and then
    // stops delivering moves, so the rectangle never grows.
    document.addEventListener('dragstart', onDragStart, true);

    function onPointerDown(event) {
      if (event.button !== 0 || (!event.metaKey && !event.ctrlKey)) {
        return;
      }
      if (!isEditingContext(event.target) || !canStartMarquee(event.target)) {
        return;
      }
      drag = {
        x: event.clientX,
        y: event.clientY,
        pointerId: event.pointerId,
        active: false,
        inModal: Boolean(event.target.closest?.('.apos-modal')),
        theme: event.target.closest?.('.apos-theme--primary-default') ||
          document.querySelector('.apos-theme--primary-default')
      };
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerUp);
    }

    function onDragStart(event) {
      if (drag) {
        event.preventDefault();
      }
    }

    function onPointerMove(event) {
      if (!drag || event.pointerId !== drag.pointerId) {
        return;
      }
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      if (!drag.active) {
        if ((dx * dx) + (dy * dy) <= threshold * threshold) {
          return;
        }
        drag.active = true;
        drag.origin = selectionSnapshot();
        window.getSelection?.().removeAllRanges();
        showBox(drag);
        try {
          event.target.setPointerCapture?.(drag.pointerId);
        } catch {
          // The pointer may already be captured, or the target may not
          // accept it. The window listeners still follow the gesture.
        }
      }
      event.preventDefault();
      drag.x2 = event.clientX;
      drag.y2 = event.clientY;
      placeBox(drag.x, drag.y, drag.x2, drag.y2);
      schedulePreview();
    }

    function onPointerUp(event) {
      if (drag && event.pointerId !== drag.pointerId) {
        return;
      }
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      if (previewFrame) {
        window.cancelAnimationFrame(previewFrame);
        previewFrame = 0;
      }
      const finished = drag;
      drag = null;
      hideBox();
      if (!finished?.active) {
        return;
      }
      swallowClick = true;
      // mouseup outside the window may never be followed by a click
      setTimeout(() => {
        swallowClick = false;
      }, 0);
      // The pointer was taken away. Put back the selection from before
      // the preview rather than keeping a rectangle that never finished.
      if (event.type === 'pointercancel') {
        writeSelection(finished.origin);
        return;
      }
      finished.x2 = event.clientX;
      finished.y2 = event.clientY;
      previewSelection(finished);
    }

    function schedulePreview() {
      if (previewFrame) {
        return;
      }
      previewFrame = window.requestAnimationFrame(() => {
        previewFrame = 0;
        if (!drag?.active) {
          return;
        }
        previewSelection(drag);
      });
    }

    // Recompute the net from the selection held when the drag armed, so a
    // widget added by an earlier move is dropped when the rectangle leaves it.
    function previewSelection(current) {
      const ids = widgetIdsInRect({
        left: current.x,
        top: current.y,
        right: current.x2,
        bottom: current.y2
      });
      const next = addCapturedWidgets(current.origin, ids, {
        parentOf: parentWidgetId
      });
      writeSelection(next);
    }

    function selectionSnapshot() {
      const store = useWidgetStore(pinia);
      return {
        selectedWidgetIds: [ ...(store.selectedWidgetIds || []) ],
        selectionAnchorId: store.selectionAnchorId ?? null,
        pinnedWidgetIds: [ ...(store.pinnedWidgetIds || []) ]
      };
    }

    function writeSelection(next) {
      const store = useWidgetStore(pinia);
      const selected = next?.selectedWidgetIds || [];
      const current = store.selectedWidgetIds || [];
      if (
        current.length === selected.length &&
        current.every((id, index) => id === selected[index])
      ) {
        return;
      }
      const primaryId = next.selectionAnchorId;
      const context = primaryId ? widgetContext(primaryId) : null;
      const graphKey = context?.el?.closest('[data-apos-graph-key]')
        ?.getAttribute('data-apos-graph-key') ||
        apos.adminBar?.contextId ||
        null;
      store.setWidgetSelection(next, {
        primaryId,
        areaId: context?.areaId || null,
        graphKey
      });
    }

    function onClick(event) {
      if (!swallowClick) {
        return;
      }
      swallowClick = false;
      event.preventDefault();
      event.stopPropagation();
    }

    function onSelectStart(event) {
      if (drag?.active) {
        event.preventDefault();
      }
    }

    function showBox(drag) {
      box = document.createElement('div');
      box.className = drag.inModal
        ? 'apos-widget-marquee apos-widget-marquee--modal'
        : 'apos-widget-marquee';
      // Tokens live on the theme, which is not an ancestor of document.body.
      // Copy the used ones so the stroke and fill resolve on the overlay.
      if (drag.theme) {
        const themeStyle = window.getComputedStyle(drag.theme);
        [ '--a-primary', '--a-primary-transparent-25' ].forEach((name) => {
          const value = themeStyle.getPropertyValue(name).trim();
          if (value) {
            box.style.setProperty(name, value);
          }
        });
      }
      document.body.appendChild(box);
    }

    function placeBox(x1, y1, x2, y2) {
      if (!box) {
        return;
      }
      box.style.left = `${Math.min(x1, x2)}px`;
      box.style.top = `${Math.min(y1, y2)}px`;
      box.style.width = `${Math.abs(x2 - x1)}px`;
      box.style.height = `${Math.abs(y2 - y1)}px`;
    }

    function hideBox() {
      box?.remove();
      box = null;
    }
  }

  function canStartMarquee(target) {
    if (!target?.closest) {
      return false;
    }
    return !target.closest(
      'input, textarea, [contenteditable], .apos-admin-bar, .apos-widget-selection-toolbar, .apos-area-widget-controls'
    );
  }

  function createWidgetClipboardApp() {
    const key = 'aposWidgetClipboard';
    const marker = 'apos-widget:';

    // Simpler and more reliable to just talk to localStorage always and avoid the
    // storage event handle
    class Clipboard {
      set(widget) {
        this.write([ widget ]);
      }

      setMany(widgets) {
        this.write(widgets);
      }

      write(widgets) {
        const list = (widgets || []).filter((widget) => widget?.type);
        if (!list.length) {
          return;
        }
        const id = createId();
        localStorage.setItem(key, JSON.stringify({
          id,
          widget: list[0],
          widgets: list
        }));
        // Stamp the OS clipboard so a later paste can tell whether this
        // widget copy is still the most recent thing the user copied
        navigator.clipboard?.writeText(`${marker}${id}`).catch(e => {
          // eslint-disable-next-line no-console
          console.warn('Unable to write the widget marker to the clipboard', e);
        });
      }

      get() {
        return this.getEntry()?.widget || null;
      }

      getMany() {
        const entry = this.getEntry();
        if (!entry) {
          return [];
        }
        if (Array.isArray(entry.widgets) && entry.widgets.length) {
          return entry.widgets;
        }
        return entry.widget?.type ? [ entry.widget ] : [];
      }

      getId() {
        return this.getEntry()?.id || null;
      }

      // Returns { id, widget } or null. Entries written by older releases
      // hold a bare widget object and are returned with a null id.
      getEntry() {
        const existing = window.localStorage.getItem(key);
        if (!existing) {
          return null;
        }
        let parsed;
        try {
          parsed = JSON.parse(existing);
        } catch (e) {
          return null;
        }
        if (!parsed || typeof parsed !== 'object') {
          return null;
        }
        if (typeof parsed.id === 'string' && Array.isArray(parsed.widgets) && parsed.widgets[0]?.type) {
          return {
            id: parsed.id,
            widget: parsed.widgets[0],
            widgets: parsed.widgets
          };
        }
        if (typeof parsed.id === 'string' && parsed.widget?.type) {
          return parsed;
        }
        return {
          id: null,
          widget: parsed
        };
      }
    }

    apos.area.widgetClipboard = new Clipboard();

    // Widget paste arrives through the native paste event rather than a
    // Ctrl+V keydown interception, so the clipboard contents decide: a
    // widget is pasted only when our marker is still the most recent copy
    document.addEventListener('paste', e => {
      if (isInsideEditable()) {
        // User is typing, native paste wins
        return;
      }
      const text = e.clipboardData?.getData('text/plain') || '';
      if (!text.startsWith(marker)) {
        return;
      }
      // Never paste the marker itself as text at area level
      e.preventDefault();
      if (text.slice(marker.length) === apos.area.widgetClipboard.getId()) {
        apos.bus.$emit('command-menu-area-paste-widget');
      }
    });

    function isInsideEditable() {
      const el = document.activeElement;
      return !!el && (
        el.nodeName === 'INPUT' ||
        el.nodeName === 'TEXTAREA' ||
        el.isContentEditable ||
        !!el.closest?.('[contenteditable]')
      );
    }
  }

  function cleanupOrphanedApps() {
    // Check all tracked apps and unmount those whose elements are no longer in the DOM
    for (const el of mountedApps.keys()) {
      if (!document.body.contains(el)) {
        unmountApp(el);
      }
    }
  }

  function unmountApp(el) {
    const app = mountedApps.get(el);
    if (app) {
      try {
        app.unmount();
      } catch (error) {
      // eslint-disable-next-line no-console
        console.error('Error unmounting Vue app:', error);
      }
      mountedApps.delete(el);
    }
  }
}
