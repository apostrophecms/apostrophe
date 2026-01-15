const { klona } = require('klona');
const { createId } = require('@paralleldrive/cuid2');
const { merge } = require('lodash');

module.exports = newInstance;

// Update: a second parameter `self` to provide distinguish server from
// client side exectution context, as we need access to managers now.
// When `self` is provided, it's assumed a backend execution context
// where `self.apos` is available. When not provided, we assume
// a frontend context where `window.apos` is available.
function newInstance(schema, self = null) {
  const instance = {};
  for (const field of schema) {
    // Look for areas later
    if (field.type !== 'area') {
      instance[field.name] = field.def !== undefined
        ? klona(field.def)
        // All fields should have an initial value in the database
        : null;
    }
    // A workaround specifically for areas. They must have a
    // unique `_id` which makes `klona` a poor way to establish
    // a default, and we don't pass functions in schema
    // definitions, but top-level areas should always exist
    // for reasonable results if the output of `newInstance`
    // is saved without further editing on the front end
    if ((field.type === 'area')) {
      if ((!instance[field.name])) {
        instance[field.name] = {
          metaType: 'area',
          items: [],
          _id: createId()
        };
      }
      if (!instance[field.name]._id) {
        instance[field.name]._id = createId();
      }

      // Support for area defaults
      if (Array.isArray(field.def) && field.def.length > 0) {
        const available = field.options.widgets
          ? Object.keys(field.options.widgets)
          : Object.values(field.options.groups).map(({ widgets }) =>
            Object.keys(widgets)).flat();
        const widgets = field.def.map(type => {
          if (!available.includes(type)) {
            console.warn(`${type} is not allowed in ${field.name} but is used in def`);
            return null;
          }
          const manager = getManager(type, self);
          if (!manager) {
            console.warn(`${type} is not a configured widget type but is used in def`);
            return null;
          }
          const wInstance = newInstance(
            manager.schema || []
          );
          wInstance._id = createId();
          wInstance.type = type;
          wInstance.metaType = 'widget';
          return normalizeWidget(wInstance, self);
        }).filter(Boolean);
        instance[field.name].items = widgets;
      }
    }
    // A workaround specifically for objects. These too need
    // to have reasonable values in parked pages and any other
    // situation where the data never passes through the UI
    if ((field.type === 'object') && ((!instance[field.name]) || (Object.keys(instance[field.name]).length === 0))) {
      instance[field.name] = newInstance(field.schema);
    }
  }
  return instance;
}

// Context aware manager retrieval
function getManager(widgetType, self) {
  if (self) {
    return self.apos.area.getWidgetManager(widgetType);
  }

  return window.apos.modules[window.apos.area.widgetManagers[widgetType]];
}

// Context aware widget normalization
function normalizeWidget(widgetInstance, self) {
  switch (widgetInstance.type) {
    case '@apostrophecms/rich-text': {
      widgetInstance._autofocus = false;
      break;
    }
    case '@apostrophecms/video':
    case '@apostrophecms/image': {
      if (typeof widgetInstance.aposPlaceholder !== 'boolean') {
        widgetInstance.aposPlaceholder = true;
      }
      break;
    }
  }

  // Contextual default data other than schema fields
  let contextData = {};
  if (self) {
    const manager = getManager(widgetInstance.type, self);
    contextData = manager?.options.defaultData || {};
  } else {
    const manager = window.apos.modules['@apostrophecms/area'];
    contextData = manager.contextualWidgetDefaultData?.[widgetInstance.type] || {};
  }

  merge(widgetInstance, contextData);

  return widgetInstance;
}
