import Vue from 'apostrophe/vue';

console.log('inside ApostropheAreas');

export default function() {
  console.log('inside ApostropheAreas function');
  const areas = [];
  // TODO this should be smarter about which areas think they
  // have been modified
  createAreaApps();
  apos.bus.$on('widgetChanged', function() {
    createAreaApps();
  });
  apos.bus.$on('areaChanged', function() {
    saveIfNeeded();
  });
  function saveIfNeeded() {
    // TODO debounce this
    areas.forEach(area => {
      // TODO is this area still alive?
      // TODO merge this data based on dotPaths
      area.serialize();
    });
    // TODO save to various docs and areas within them
  }
  function createAreaApps() {
    const els = document.querySelectorAll('[data-apos-area-newly-editable]');
    for (let el of els) {
      areas.push(createAreaApp(el));
    }
  }
  function createAreaApp(el) {

    const options = JSON.parse(el.getAttribute('data-options'));
    const data = JSON.parse(el.getAttribute('data'));
    const choices = JSON.parse(el.getAttribute('data-choices'));
    el.removeAttribute('data-apos-area-newly-editable');

    const component = window.apos.areas.components.editor;

    return new Vue({
      el: el,
      data: {
        options: options,
        items: data.items,
        choices: choices
      },
      template: `<${component} :options="options" :items="items" :choices="choices" />`,
    });

  }
};
