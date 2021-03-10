var async = require('async');
module.exports = function(self, options) {
  var launder = self.apos.launder;

  self.apiRoute('post', 'save-area', function(req, res, next) {
    return self.lockSanitizeAndSaveArea(req, req.body, function(err, info) {
      if (err === 'locked-by-me') {
        return next('locked', null, { message: req.__ns('apostrophe', 'You are now editing this document in another tab or window.') });
      } else if (err === 'locked') {
        return next('locked', null, { message: req.__ns('apostrophe', 'Another user has taken control of this document.') });
      } else {
        return next(err);
      }
    });
  });

  // Similar to `save-area`. This route expects
  // an object with an `areas` property, and that
  // property is an array of requests in the format
  // expected by the `save-area` route. In addition to
  // saving all of the posted areas, this route
  // releases any locks held by `req.htmlPageId`.
  // property. These functions are combined for
  // best performance during performance-critical
  // `beforeunload` events.

  self.apiRoute('post', 'save-areas-and-unlock', function(req, res, next) {

    var areas = req.body.areas;
    if (!Array.isArray(areas)) {
      return next('invalid');
    }
    return async.series([
      lockSanitizeAndSaveAreas,
      unlockAll
    ], next);

    function lockSanitizeAndSaveAreas(callback) {
      return async.eachSeries(areas, function(areaInfo, callback) {
        return self.lockSanitizeAndSaveArea(req, areaInfo, function(err) {
          // An error here is nonfatal because we want to give
          // other areas a chance to save if, for instance, another
          // user stole a lock on just one of them
          if (err) {
            self.logError(req, err);
          }
          return callback(null);
        });
      }, callback);
    }

    function unlockAll(callback) {
      if (!req.htmlPageId) {
        // For bc
        return callback(null);
      }
      return self.apos.docs.unlockAll(req, req.htmlPageId, callback);
    }
  });

  // Render an editor for each of many virtual areas passed as
  // `req.body.areas`, with `items` and `options` properties for each.
  // The areas will not attempt to save themselves periodically.
  //
  // Used to implement editing of areas within schemas.

  self.apiRoute('post', 'edit-virtual-areas', function(req, res, next) {
    var areas = req.body.areas || [];
    var rendered = [];
    return async.eachSeries(areas, function(area, callback) {
      return self.editVirtualArea(req, area.items || [], area.options || [], function(err, html) {
        if (err) {
          return callback(err);
        }
        rendered.push(html);
        return callback(null);
      });
    }, function(err) {
      if (err) {
        return next(err);
      }
      return next(null, {
        areas: rendered
      });
    });
  });

  // Render an editor for a virtual area with the content
  // specified as an array of items by the `req.body.items` and
  // and the options specified by `req.body.options`.
  // The area will not attempt to save itself periodically.
  //
  // Used to implement editing of areas within schemas.

  self.renderRoute('post', 'edit-virtual-area', function(req, res, next) {
    var items = req.body.items || [];
    var options = req.body.options || {};
    return self.editVirtualArea(req, items, options, next);
  });

  // Implementation detail of the `edit-virtual-area` and `edit-virtual-areas` routes.

  self.editVirtualArea = function(req, items, options, callback) {
    var area = {
      type: 'area',
      _docId: 'v' + self.apos.utils.generateId(),
      _edit: true
    };
    // virtual option prevents attributes used to
    // save content from being output
    options.virtual = true;
    options.area = area;
    area.items = [];

    return async.eachSeries(items, function(item, callback) {
      var manager = self.getWidgetManager(item.type);
      if (!manager) {
        self.warnMissingWidgetType(item.type);
        return callback(new Error('invalid'));
      }
      var widgetsOptions = options.widgets || {};
      var widgetOptions = widgetsOptions[item.type] || {};
      if (!self.apos.utils.isBlessed(req, widgetOptions, 'widget', item.type)) {
        return callback('The widget options are not blessed. Usually this means you are\n' +
          'editing the same widget both contextually and in a dialog box, and\n' +
          'you are not passing the same widget options in index.js and in the\n' +
          'template, or you are not passing the widget options in index.js\n' +
          'at all. Either set the area to contextual: true, which keeps it\n' +
          'out of the dialog box, or set the "widgets" option to match the\n' +
          'last argument to "apos.area" in your template.\n\n' +
          'unblessed: ' + item.type + ', ' + JSON.stringify(widgetOptions, null, '  '));
      }
      var widget;
      return async.series({
        sanitize: function(callback) {
          req.tolerantSanitization = true;
          return manager.sanitize(req, item, function(err, _widget) {
            if (err) {
              return callback(err);
            }
            widget = _widget;
            widget._edit = true;
            area.items.push(widget);

            return callback(null);
          });
        },
        load: function(callback) {
          if (!manager.load) {
            return setImmediate(callback);
          }
          // Hint to call nested widget loaders as if it were a doc
          widget._virtual = true;
          return manager.load(req, [ widget ], callback);
        }
      }, callback);

    }, function(err) {
      if (err) {
        return callback(err);
      }
      try {
        // This template is a shim to call the
        // apos.area helper
        return callback(null, self.render(req, 'virtualArea', {
          options: options
        }));
      } catch (e) {
        return callback(e);
      }
    });
  };

  // Render a view of the widget specified by req.body.data (which contains its
  // properties) and req.body.options (treated as if they were passed to it via
  // aposSingleton). req.body.type specifies the widget type. It is assumed that
  // the widget is editable and should be rendered with contextual editing controls
  // if it supports them.

  self.htmlRoute('post', 'render-widget', function(req, res, next) {
    var originalData = (typeof (req.body.originalData) === 'object') ? req.body.originalData : {};
    var data = (typeof (req.body.data) === 'object') ? req.body.data : {};
    var options = (typeof (req.body.options) === 'object') ? req.body.options : {};
    var type = launder.string(req.body.type);
    var widget;
    var html;
    if (!(data && options && type)) {
      return next('invalid');
    }
    var manager = self.getWidgetManager(type);
    if (!manager) {
      self.warnMissingWidgetType(type);
      return next('invalid');
    }
    if (!self.apos.utils.isBlessed(req, options, 'widget', type)) {
      return next(new Error('The widget options are not blessed. Usually this means you are\n' +
          'editing the same widget both contextually and in a dialog box, and\n' +
          'you are not passing the same widget options in index.js and in the\n' +
          'template, or you are not passing the widget options in index.js\n' +
          'at all. Either set the area to contextual: true, which keeps it\n' +
          'out of the dialog box, or set the "widgets" option to match the\n' +
          'last argument to "apos.area" in your template.\n\n' +
          'unblessed: ' + type + ', ' + JSON.stringify(options, null, '  ')));
    }
    return async.series({
      sanitize: function(callback) {
        return manager.sanitize(req, data, function(err, _widget) {
          if (err) {
            return callback(err);
          }
          widget = _widget;
          widget._edit = true;
          self.restoreDisallowedFields(req, widget, originalData);
          return callback(null);
        });
      },
      load: function(callback) {
        // Hint to call nested widget loaders as if it were a doc
        widget._virtual = true;
        return manager.load(req, [ widget ], callback);
      },
      render: function(callback) {
        try {
          return self.renderWidget(req, type, widget, options, function(err, _html) {
            if (err) {
              return callback(err);
            }
            html = _html;
            return callback(null);
          });
        } catch (e) {
          // Catch errors in renderWidget
          return callback(e);
        }
      }
    }, function(err) {
      return next(err, html);
    });
  });

  // Supplies static DOM templates to the editor on request
  self.renderRoute('post', 'editor', function(req, res, next) {
    return next(null, {
      template: 'editor',
      data: {
        // To prevent developer warnings. We're only outputting this as a template
        // to be cloned but the widgetControlGroups method expects real input
        widget: {},
        options: {}
      }
    });
  });

};
