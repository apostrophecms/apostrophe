var _ = require('lodash');

module.exports = function(self, options) {
  self.apos.templates.addToApos({
    /* or { area: area, type: type, ... more options } */
    singleton: function(doc, name, type, options) {
      var area;
      var options;
      var util = require('util');
      if (arguments.length === 1) {
        options = doc;
      } else {
        options = options || {};
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
        definition: self.widgetManagers[options.type]
      });
      return result;
    },
    widget: function(widget, options) {
      return self.partial('widget', {
        widget: widget,
        options: options,
        output: function() {
          return self.widgetManagers[widget.type].output(widget, options);
        }
      });
    }
  });
};
