// Implements {% area doc, 'areaName', { options... } %}
// Also supported: {% area { area: foo, other options ... } %}

const _ = require('lodash');

module.exports = function(self, options) {

  return {
    async run(req, doc, name, options) {
      let area;
      if ((arguments.length < 2) || (arguments.length > 4)) {
        throw usage('Incorrect number of arguments.');
      }
      if (arguments.length >= 3) {
        if (!options) {
          options = {};
        }
        if ((!doc) || ((typeof doc) !== 'object')) {
          throw usage('You must pass an existing doc or widget as the first argument when using the {% area doc, \'areaName\', { options... } %} syntax.');
        }
        if ((typeof name) !== 'string') {
          throw usage('The second argument must be an area name when using the {% area doc, \'areaName\', { options... } %} syntax.');
        }
        if (!name.match(/^\w+$/)) {
          throw usage('area names should be made up only of letters, underscores and digits. Otherwise they will not save properly.');
        }
        area = doc[name];
        if (!area) {
          area = {
            // If the "doc" is actually a widget, continue the path
            _docId: doc.__docId || doc._id,
            _dotPath: (doc.__dotPath ? (doc.__dotPath + '.') : '') + name,
            _edit: doc._edit
          };
        }
      } else {
        if ((!options) || ((typeof options) !== 'object')) {
          throw usage('using the {% area { area: someDoc.someAreaName, other options... } %} syntax.');
        }
        area = options.area;
        if (!area) {
          throw usage('When using the {% area { area: someDoc.someAreaName, other options... } %} syntax, the area must already exist.');
        }
      }
      if (area._edit) {
        _.each(_.keys(options.widgets), type => {
          const manager = self.getWidgetManager(type);
          options.widgets[type] = {
            ...(manager.options.defaultOptions || {}),
            ...options.widgets[type]
          };
        });
        // Don't fill the session with blessings of option sets unless
        // this user actually can edit this area
        _.each(options.widgets || {}, function(options, type) { 
          self.apos.utils.bless(req, options, 'widget', type);
        });
      }
      return self.apos.areas.renderArea(req, area, options);

      function usage(message) {
        return new Error(`${message}

  Usage: {% area data.page, 'areaName', { options ... } %} OR

  {% area { area: data.page.areaName, other options ... } %}

  The first syntax is required if the area might not already exist.`
        );
      }
    }
  };

};

