// When choosing images, autocomplete by title is not a sensible primary
// interface; let them go straight to the browse button and just use the
// chooser to edit existing selections

apos.define('apostrophe-images-chooser', {
  extend: 'apostrophe-pieces-chooser',
  autocomplete: false
});

