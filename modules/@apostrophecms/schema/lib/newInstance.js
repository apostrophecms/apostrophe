const { klona } = require('klona');
const { createId } = require('@paralleldrive/cuid2');

module.exports = newInstance;

function newInstance(schema) {
  const instance = {};
  for (const field of schema) {
    if (field.def !== undefined) {
      instance[field.name] = klona(field.def);
    } else {
      // All fields should have an initial value in the database
      instance[field.name] = null;
    }
    // A workaround specifically for areas. They must have a
    // unique `_id` which makes `klona` a poor way to establish
    // a default, and we don't pass functions in schema
    // definitions, but top-level areas should always exist
    // for reasonable results if the output of `newInstance`
    // is saved without further editing on the front end
    if ((field.type === 'area') && (!instance[field.name])) {
      instance[field.name] = {
        metaType: 'area',
        items: [],
        _id: createId()
      };
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
