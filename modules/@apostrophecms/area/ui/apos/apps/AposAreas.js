import Vue from 'Modules/@apostrophecms/ui/lib/vue';
import { klona } from 'klona';

export default function() {

  createWidgetClipboardApp();

  prepareAreas();
  apos.bus.$on('widget-rendered', function() {
    prepareAreas();
  });
  apos.bus.$on('refreshed', function() {
    prepareAreas();
  });

  function prepareAreas() {
    // Doing this first allows markup to be captured for the editor
    // before players alter it
    createAreaApps();
    // Even though we invoke the player directly from
    // the widget mixin used for editable widgets, we still have to
    // call runPlayers eventually to account for any foreign area widgets
    apos.util.runPlayers();
  }

  function createAreaApps() {
    // Sort the areas by DOM depth to ensure parents light up before children
    const els = Array.from(document.querySelectorAll('[data-apos-area-newly-editable]'));
    els.sort((a, b) => {
      const da = depth(a);
      const db = depth(b);
      if (da < db) {
        return -1;
      } else if (db > da) {
        return 1;
      } else {
        return 0;
      }
    });
    for (const el of els) {
      createAreaApp(el);
    }
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

    const options = JSON.parse(el.getAttribute('data-options'));
    const data = JSON.parse(el.getAttribute('data'));
    const fieldId = el.getAttribute('data-field-id');
    const choices = JSON.parse(el.getAttribute('data-choices'));
    const renderings = {};
    const _docId = data._docId;

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

    const component = window.apos.area.components.editor;

    if (apos.area.activeEditor && (apos.area.activeEditor.id === data._id)) {
      // Editing a piece causes a refresh of the main content area,
      // but this may contain the area we originally intended to add
      // a widget to when we created a piece for that purpose. Preserve
      // the editing experience by restoring that widget's editor to the DOM
      // rather than creating a new one.
      el.parentNode.replaceChild(apos.area.activeEditor.$el, el);
    } else {
      return new Vue({
        el,
        data: function() {
          return {
            options,
            id: data._id,
            items: data.items,
            choices,
            docId: _docId,
            fieldId,
            renderings
          };
        },
        template: `<${component} :options="options" :items="items" :choices="choices" :id="$data.id" :docId="$data.docId" :fieldId="fieldId" :renderings="renderings" />`
      });
    }
  }

  function createWidgetClipboardApp() {
    // Headless app to provide simple reactivity for the clipboard state
    apos.area.widgetClipboard = new Vue({
      el: null,
      data: () => {
        const existing = window.localStorage.getItem('aposWidgetClipboard');
        return {
          widgetClipboard: existing ? JSON.parse(existing) : null
        };
      },
      mounted() {
        window.addEventListener('storage', this.onStorage);
      },
      methods: {
        set(widget) {
          this.widgetClipboard = widget;
          localStorage.setItem('aposWidgetClipboard', JSON.stringify(this.widgetClipboard));
        },
        get() {
          // If we don't clone, the second paste will be a duplicate key error
          return klona(this.widgetClipboard);
        },
        onStorage() {
          // When local storage changes, dump the list to
          // the console.
          const contents = window.localStorage.getItem('aposWidgetClipboard');
          if (contents) {
            this.widgetClipboard = JSON.parse(contents);
          }
        }
      }
    });
  }

};
