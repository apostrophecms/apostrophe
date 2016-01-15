var _ = require('lodash');

module.exports = function(self, options) {
  self.addHelpers({
    /* or { area: area, type: type, ... more options } */
    singleton: function(doc, name, type, _options) {
      var area;
      var options;

      if (arguments.length === 1) {
        // TODO fix this api, now that singletons are a special case of area
        options = _.defaults(doc, options);
        options = doc;
        area = options.area;
      } else {
        options = {
          type: type
        };
        if (_.has(doc, name)) {
          area = doc[name];
        } else {
          area = {
            _docId: doc._id,
            _dotPath: name,
            _edit: doc._edit
          };
        }
      }

      // Need to make the widget definition options configured the same
      // way as in areas to support drag n drop.
      options.widgets = {};
      options.widgets[type] = _options || {};

      // var widget = self.findSingletonWidget(options.area, options.type);

      // Don't fill the session with blessings of option sets unless
      // this user actually can edit this singleton
      if (area._edit) {
        self.apos.utils.bless(self.apos.templates.contextReq, _.omit(options, 'area'), 'widget', options.type);
      }

      options.limit = 1;

      return self.renderArea(area, options);
    },

    /* or { area: area, ... more options } */

    area: function(doc, name, _options) {
      var area;
      var options;

      if (arguments.length === 1) {
        options = doc;
        area = options.area;
      } else {
        options = _options || {};
        if (_.has(doc, name)) {
          area = doc[name];
        } else {
          area = {
            _docId: doc._id,
            _dotPath: name,
            _edit: doc._edit
          };
        }
      }

      options.hint = options.hint || self.apos.templates.contextReq.__('Use the Add Content button to get started.');

      // Don't fill the session with blessings of option sets unless
      // this user actually can edit this area
      if (area._edit) {
        _.each(options.widgets || {}, function(options, type) {
          self.apos.utils.bless(self.apos.templates.contextReq, options, 'widget', type);
        });
      }

      return self.renderArea(area, options);
    },

    widget: function(widget, options) {
      var manager = self.getWidgetManager(widget.type);
      if (!manager) {
        // Not configured in this project
        return '';
      }
      return self.partial('widget', {
        // The widget minus any properties that don't
        // absolutely need to be crammed into a JSON
        // attribute for the editor's benefit. Good filtering
        // here prevents megabytes of markup. -Tom and Sam
        dataFiltered: manager.filterForDataAttribute(widget),
        manager: manager,
        widget: widget,
        options: options,
        output: function() {
          return manager.output(widget, options);
        }
      });
    }
  });
  // These are the most frequently used helpers in A2,
  // so we allow their use without typing .areas first
  self.addHelperShortcut('area');
  self.addHelperShortcut('singleton');
};
