var _ = require('lodash');

module.exports = function(self, options) {
  self.addHelpers({
    /* or { area: area, type: type, ... more options } */
    singleton: function(doc, name, type, _options) {
      var area;
      var options;
      if (arguments.length === 1) {
        options = doc;
      } else {
        options = _options || {};
        options.type = type;
        if (_.has(doc, name)) {
          options.area = doc[name];
        } else {
          options.area = {
            _docId: doc._id,
            _dotPath: name,
            _edit: doc._edit
          };
        }
      }
      var widget = self.findSingletonWidget(options.area, options.type);
      var result = self.partial('singleton', {
        widget: widget,
        options: options,
        area: options.area,
        manager: self.getWidgetManager(options.type)
      });
      return result;
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

      var result = self.partial('area', {
        area: area,
        options: options,
        widgetManagers: self.widgetManagers
      });

      return result;
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
