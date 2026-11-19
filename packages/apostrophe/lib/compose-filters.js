/**
 * Shared utility for composing filters in doc-type and page modules.
 *
 * Transforms a filters object (keyed by name) into an array of filter
 * definitions with normalized inputType, default values, and null choices.
 *
 * This was previously duplicated between:
 * - @apostrophecms/doc-type/index.js composeFilters()
 * - @apostrophecms/page/index.js composeFilters()
 *
 * @param {Object} filters - An object keyed by filter name, where each value
 *   is a filter definition object.
 * @returns {Array} An array of composed filter objects with `name` property added.
 */
module.exports = function composeFilters(filters) {
  const composed = Object.entries(filters)
    .map(([ name, filter ]) => ({
      name,
      ...filter,
      inputType: filter.inputType || 'select'
    }));

  // Add a null choice if not already added or set to `required`
  composed.forEach((filter) => {
    if (Array.isArray(filter.choices)) {
      if (
        !filter.required &&
        !filter.choices.find((choice) => choice.value === null)
      ) {
        filter.def = null;
        filter.choices = filter.inputType === 'checkbox'
          ? filter.choices
          : filter.choices.concat({
            value: null,
            label: 'apostrophe:none'
          });
      }
    } else {
      // Dynamic choices from the REST API, but
      // we need a label for "no opinion"
      filter.nullLabel = filter.inputType === 'radio'
        ? 'apostrophe:any'
        : 'apostrophe:filterMenuChooseOne';
    }
    if (filter.inputType === 'checkbox') {
      filter.def = [];
    }
  });

  return composed;
};
