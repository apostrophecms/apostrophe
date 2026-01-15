
import createApp from 'Modules/@apostrophecms/ui/lib/vue';
import { nextTick } from 'vue';

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
    let lowest = Math.min(...els.map(el => depth(el)));
    els.filter(el => depth(el) === lowest).forEach(el => createAreaApp(el));
  }

  function depth(el) {
    let depth = 0;
    while (el) {
      el = el.parentNode;
      depth++;
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

    if (apos.area.activeEditor && (apos.area.activeEditor.id === data._id)) {
      // Editing a piece causes a refresh of the main content area,
      // but this may contain the area we originally intended to add
      // a widget to when we created a piece for that purpose. Preserve
      // the editing experience by restoring that widget's editor to the DOM
      // rather than creating a new one.

      el.parentNode.replaceChild(apos.area.activeEditor.$el, el);
    } else {
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

      app.mount(el);
      mountedApps.set(el, app);
    }
  }

  function createWidgetClipboardApp() {

    // Simpler and more reliable to just talk to localStorage always and avoid the
    // storage event handle
    class Clipboard {
      set(widget) {
        localStorage.setItem('aposWidgetClipboard', JSON.stringify(widget));
      }

      get() {
        const existing = window.localStorage.getItem('aposWidgetClipboard');
        return existing ? JSON.parse(existing) : null;
      }
    }

    apos.area.widgetClipboard = new Clipboard();

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
