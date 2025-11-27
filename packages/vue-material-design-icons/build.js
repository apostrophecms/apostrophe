#!/usr/bin/env node

const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const pMap = require('p-map');
const icons = require('@mdi/js/commonjs/mdi.js');

const dist = path.resolve(__dirname, 'dist');

function renderTemplate(title, svgPathData, name) {
  return `<template>
  <span
    v-bind="$attrs"
    :aria-hidden="title ? null : true"
    :aria-label="title"
    class="material-design-icon ${title}-icon"
    role="img"
    @click="$emit('click', $event)"
  >
    <svg
      :fill="fillColor"
      class="material-design-icon__svg"
      :width="size"
      :height="size"
      viewBox="0 0 24 24"
    >
      <path d="${svgPathData}">
        <title v-if="title">{{ title }}</title>
      </path>
    </svg>
  </span>
</template>

<script>
export default {
  name: '${name}Icon',
  props: {
    title: {
      type: String,
      default: null
    },
    fillColor: {
      type: String,
      default: 'currentColor'
    },
    size: {
      type: Number,
      default: 24
    }
  },
  emits: [ 'click' ]
};
</script>`;
}

function getTemplateData(id) {
  const splitID = id.split(/(?=[A-Z])/).slice(1);

  const name = splitID.join('');

  // This is a hacky way to remove the 'mdi' prefix, so "mdiAndroid" becomes
  // "android", for example
  const title = splitID.join('-').toLowerCase();

  return {
    name,
    title,
    svgPathData: icons[id]
  };
}

async function build() {
  const iconIDs = Object.keys(icons);

  if (!fs.existsSync(dist)) {
    await fsp.mkdir(dist);
  }

  const templateData = iconIDs.map(getTemplateData);

  // Batch process promises to avoid overloading memory
  await pMap(
    templateData,
    async ({
      name, title, svgPathData
    }) => {
      const component = renderTemplate(title, svgPathData, name);
      const filename = `${name}.vue`;

      return fsp.writeFile(path.resolve(dist, filename), component);
    },
    { concurrency: 20 }
  );
}

build().catch((err) => {
  console.log(err);
});
