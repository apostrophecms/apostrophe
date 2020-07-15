/*
  NOTE: This file is used as a template to generate the preview.js file for storybook.
  You may add additional "things" story book needs but we'll find all the imports and
  register the components dynamically.
*/

import Vue from 'apostrophe/vue';
import { addDecorator } from '@storybook/vue';
import { withContexts } from '@storybook/addon-contexts/vue';
import { contexts } from './configs/contexts';

// IMPORTS

addDecorator(withContexts(contexts));

// COMPONENTS
