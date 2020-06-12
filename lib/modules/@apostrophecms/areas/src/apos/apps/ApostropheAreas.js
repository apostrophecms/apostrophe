import Vue from 'apostrophe/vue';

export default function() {

  createAreaApps();
  window.apos.bus.$on('widgetRendered', function() {
    createAreaApps();
  });

  function createAreaApps() {
    const els = document.querySelectorAll('[data-apos-area-newly-editable]');
    for (let el of els) {
      createAreaApp(el);
    }
  }

  function createAreaApp(el) {

    const options = JSON.parse(el.getAttribute('data-options'));
    const data = JSON.parse(el.getAttribute('data'));
    const fieldId = el.getAttribute('data-field-id');
    const choices = JSON.parse(el.getAttribute('data-choices'));
    el.removeAttribute('data-apos-area-newly-editable');

    const component = window.apos.areas.components.editor;

    const _docId = data._docId;

    return new Vue({
      el: el,
      data: {
        options,
        _id: data._id,
        items: data.items,
        choices,
        _docId,
        fieldId
      },
      template: `<${component} :options="options" :items="items" :choices="choices" :_id="$data._id" :_docId="$data._docId" :fieldId="fieldId" />`
    });

  }
};
