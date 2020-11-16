import Vue from 'apostrophe/vue';
import { VTooltip } from 'v-tooltip';
import tooltipConfig from 'Modules/@apostrophecms/ui/lib/tooltip';

tooltipConfig.updateOptions(VTooltip);
Vue.directive('tooltip', VTooltip);

export default function() {

  createAreaApps();
  window.apos.bus.$on('widget-rendered', function() {
    createAreaApps();
  });
  window.apos.bus.$on('refreshed', function() {
    createAreaApps();
  });

  function createAreaApps() {
    const els = document.querySelectorAll('[data-apos-area-newly-editable]');
    for (const el of els) {
      createAreaApp(el);
    }
  }

  function createAreaApp(el) {

    const options = JSON.parse(el.getAttribute('data-options'));
    const data = JSON.parse(el.getAttribute('data'));
    const fieldId = el.getAttribute('data-field-id');
    const choices = JSON.parse(el.getAttribute('data-choices'));
    el.removeAttribute('data-apos-area-newly-editable');

    const component = window.apos.area.components.editor;

    const _docId = data._docId;

    return new Vue({
      el: el,
      data: function() {
        return {
          options,
          id: data._id,
          items: data.items,
          choices,
          docId: _docId,
          fieldId
        };
      },
      template: `<${component} :options="options" :items="items" :choices="choices" :id="$data.id" :docId="$data.docId" :fieldId="fieldId" />`
    });

  }
};
