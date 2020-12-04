import Vue from 'Modules/@apostrophecms/ui/lib/vue';

export default function() {

  createAreaApps();
  window.apos.bus.$on('widget-rendered', function() {
    createAreaApps();
  });
  window.apos.bus.$on('refreshed', function() {
    createAreaApps();
  });

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
    
    return new Vue({
      el: el,
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
};
