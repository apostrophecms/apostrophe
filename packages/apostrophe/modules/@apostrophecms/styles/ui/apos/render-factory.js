import { createRenderer } from './universal/render.mjs';
import checkIfConditions from 'apostrophe/lib/universal/check-if-conditions.mjs';

let instance = null;

export function getRenderer(overrides = {}) {
  if (Object.keys(overrides).length) {
    return createRenderer({
      checkIfConditionsFn: checkIfConditions,
      imageSizes: window.apos.attachment.imageSizes,
      ...overrides
    });
  }
  if (!instance) {
    instance = createRenderer({
      checkIfConditionsFn: checkIfConditions,
      imageSizes: window.apos.attachment.imageSizes
    });
  }
  return instance;
}

export function renderGlobalStyles(schema, doc, options = {}) {
  return getRenderer().renderGlobalStyles(schema, doc, options);
}

export function renderScopedStyles(schema, doc, options = {}) {
  return getRenderer().renderScopedStyles(schema, doc, options);
}
