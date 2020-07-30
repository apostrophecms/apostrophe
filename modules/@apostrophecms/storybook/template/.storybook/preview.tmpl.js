/*
  NOTE: This file is used as a template to generate the preview.js file for storybook.
  You may add additional "things" story book needs but we'll find all the imports and
  register the components dynamically.

  DO NOT REMOVE ANY ALL-CAPS HEADERS. They are placeholders in the build.
*/

import Vue from 'apostrophe/vue';
if (window.apos.modules) {
  for (const module of Object.values(window.apos.modules)) {
    if (module.alias) {
      window.apos[module.alias] = module;
    }
  }
}
window.apos.bus = new Vue();

import { addDecorator, addParameters } from '@storybook/vue';
import { withContexts } from '@storybook/addon-contexts/vue';
import { contexts } from './configs/contexts';

// IMPORTS

addDecorator(withContexts(contexts));
// https://storybook.js.org/docs/configurations/options-parameter/#sorting-stories
addParameters({
  options: {
    storySort: (a, b) =>
      a[1].kind === b[1].kind ? 0 : a[1].id.localeCompare(b[1].id, undefined, { numeric: true }),
  },
});
// COMPONENTS
