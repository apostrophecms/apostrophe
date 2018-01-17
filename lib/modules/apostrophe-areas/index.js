// An area is a series of zero or more widgets, in which users can add
// and remove widgets and drag them to reorder them. This module implements
// areas, including calling the loader methods of widgets that have them
// whenever a doc containing areas is fetched, via an extension to
// `apostrophe-cursors`. This module also provides browser-side support for
// invoking the players of widgets in an area and for editing areas.

module.exports = {

  alias: 'areas',

  construct: function(self, options) {
    require('./lib/api.js')(self, options);
    require('./lib/protectedApi.js')(self, options);
    require('./lib/helpers.js')(self, options);
    require('./lib/routes.js')(self, options);
    require('./lib/browser.js')(self, options);
  }
};
