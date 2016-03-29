apos.define('apostrophe-pages-chooser', {
  extend: 'apostrophe-docs-chooser',
  // The standard manage modal is inappropriate for pages. Someday we might do something
  // based on the page tree, but for now just stick to autocomplete only
  browse: false
});
