export default {
  // NOTE: docId is always null, investigate if needed
  // docId is null with a reason (at least for now).
  // It affects the "foreign" checks in area/widget-area editors.
  // docId: String,
  type: String,
  areaFieldId: String,
  modelValue: Object,
  mode: {
    type: String,
    default: 'draft'
  },
  meta: {
    type: Object,
    default() {
      return {};
    }
  },
  // Ignored for server side rendering
  areaField: Object,
  followingValues: Object,
  // Fix missing prop rendered as `[object Object]` attribute in the DOM
  options: Object,
  rendering: {
    type: Object,
    default() {
      return null;
    }
  }
};
