// Requires the module options and an area field's .options property

import getWidgets from './get-widgets.js';

export default function filterCreateWidgetOperations(moduleOptions, areaOptions) {
  const widgets = getWidgets(areaOptions);
  return moduleOptions.createWidgetOperations.filter(createWidgetOperation => {
    if (createWidgetOperation.ifTypesIntersect) {
      const types = Object.keys(widgets);
      if (!types.some(type => createWidgetOperation.ifTypesIntersect.includes(type))) {
        return false;
      }
    }
    return true;
  });
}
