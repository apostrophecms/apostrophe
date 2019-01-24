import Vue from 'apostrophe/vue';

import axios from 'axios';
import cookies from 'js-cookie';

export default function() {

  const areas = [];
  const dataByParentId = {};
  const extantDocIds = {};

  // TODO this should be smarter about which areas think they
  // have been modified
  createAreaApps();
  apos.bus.$on('widgetChanged', function() {
    createAreaApps();
  });

  async function save() {
    // TODO: don't save things we didn't touch
    const docIds = Object.keys(extantDocIds);
    try {
      for (let docId of docIds) {
        const areaNames = Object.keys(dataByParentId[docId]);
        for (let areaName of areaNames) {
          const data = dataByParentId[docId][areaName];
          const items = data.items;
          const options = data.options;

          // Because Vue cannot "see" inside non-Vue bits of DOM, each area editor
          // only knows about its own widgets and their direct schema properties
          // that are not nested areas.
          patchSubareas(items);
          await axios.create({
            headers: {
              'X-XSRF-TOKEN': cookies.get(window.apos.csrfCookieName)
            }
          }).post(
            apos.areas.action + '/save-area',
            {
              docId: docId,
              dotPath: areaName,
              items: items,
              options: options
            }
          );
        }
      }
    } catch (e) {
      // apos.notify
      console.error(e);
    }

    function patchSubareas(items) {
      for (let item of items) {
        const _id = item._id;
        const kidsByAreaName = dataByParentId[_id] || {};
        const areaNames = Object.keys(kidsByAreaName);
        for (let areaName of areaNames) {
          const data = kidsByAreaName[areaName];
          item[areaName] = {
            type: 'area',
            items: data.items,
            options: data.options
          };
          patchSubareas(data.items);
        }
      }
    }

  }

  function createAreaApps() {
    const els = document.querySelectorAll('[data-apos-area-newly-editable]');
    for (let el of els) {
      areas.push(createAreaApp(el));
    }
  }

  function updateParentIdMap(areaApp, items, options) {
    dataByParentId[areaApp.parentId] = dataByParentId[areaApp.parentId] || {};
    dataByParentId[areaApp.parentId][areaApp.areaName] = dataByParentId[areaApp.parentId][areaApp.areaName] || {};
    dataByParentId[areaApp.parentId][areaApp.areaName].items = items;
    if (options) {
      dataByParentId[areaApp.parentId][areaApp.areaName].options = options;
    }
  }

  function createAreaApp(el) {

    const options = JSON.parse(el.getAttribute('data-options'));
    const data = JSON.parse(el.getAttribute('data'));
    const choices = JSON.parse(el.getAttribute('data-choices'));
    el.removeAttribute('data-apos-area-newly-editable');

    const component = window.apos.areas.components.editor;

    const docId = data._docId;
    const dotPath = data._dotPath;
    const parts = dotPath.split('.');
    const areaName = parts[parts.length - 1];
    const parentId = data._parentId;
    extantDocIds[docId] = true;

    return new Vue({
      el: el,
      data: {
        options: options,
        items: data.items,
        choices: choices,
        docId: docId,
        parentId: parentId,
        areaName: areaName
      },
      mounted() {
        updateParentIdMap(this, data.items, options);
      },
      methods: {
        changed(items) {
          updateParentIdMap(this, items);
          save();
        }
      },
      template: `<${component} :options="options" :items="items" :choices="choices" @input="changed" />`,
    });

  }
};
