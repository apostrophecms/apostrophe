
import createApp, { pinia } from 'Modules/@apostrophecms/ui/lib/vue';
import { useWidgetGraphStore } from 'Modules/@apostrophecms/ui/stores/widgetGraph.js';
import { nextTick } from 'vue';
import { createId } from '@paralleldrive/cuid2';

export default function() {
  const mountedApps = new Map();
  let widgetsRendering = 0;
  apos.area.widgetOptions = [];

  createWidgetClipboardApp();

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
      }
    }

    function observed(entries) {
      const intersects = entries[0].isIntersecting;
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

  function createWidgetClipboardApp() {
    const key = 'aposWidgetClipboard';
    const marker = 'apos-widget:';

    // Simpler and more reliable to just talk to localStorage always and avoid the
    // storage event handle
    class Clipboard {
      set(widget) {
        const id = createId();
        localStorage.setItem(key, JSON.stringify({
          id,
          widget
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
