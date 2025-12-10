import { klona } from 'klona';
import { createId } from '@paralleldrive/cuid2';

// Safely clone a widget. Regenerates all array item, area, object
// and widget ids so they are considered new. Useful when copying
// a widget with nested content.

export default function cloneWidget(widget) {
  const object = klona(widget);
  regenerateIds(getSchema(widget.type), object);
  return object;
}

function regenerateIds(schema, object) {
  object._id = createId();
  for (const field of schema) {
    if (field.type === 'array') {
      for (const item of (object[field.name] || [])) {
        regenerateIds(field.schema, item);
      }
    } else if (field.type === 'object') {
      regenerateIds(field.schema, object[field.name] || {});
    } else if (field.type === 'area') {
      if (object[field.name]) {
        object[field.name]._id = createId();
        for (const item of (object[field.name].items || [])) {
          const schema = getSchema(item.type);
          regenerateIds(schema, item);
        }
      }
    }
    // We don't want to regenerate attachment ids. They correspond to
    // actual files, and the reference count will update automatically
  }
}

function getSchema(type) {
  return apos.modules[apos.area.widgetManagers[type]].schema;
}
