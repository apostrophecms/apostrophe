apos.define('apostrophe-any-page-manager-chooser', {
  extend: 'apostrophe-doc-type-manager-chooser',
  // The standard manage modal is not available for or suitable for pages.
  // Someday we might do something based on the page tree, but for now just
  // stick to autocomplete only
  browse: false
});
