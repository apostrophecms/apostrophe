var async = require('async');

module.exports = function(self, options) {
  var launder = self.apos.launder;

  self.route('post', 'save-area', function(req, res) {
    return self.lockSanitizeAndSaveArea(req, req.body, function(err, info) {
      if (err) {
        if (err === 'locked-by-me') {
          return res.send({ status: 'locked', message: self.apos.i18n.__('You are now editing this document in another tab or window.') });
        } else if (err === 'locked') {
          return res.send({ status: 'locked', message: self.apos.i18n.__('Another user has taken control of this document.') });
        }
        return res.send({ status: (typeof (err) === 'string') ? err : 'error' });
      }
      return res.send({ status: 'ok' });
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

  self.route('post', 'save-areas-and-unlock', function(req, res) {

    var areas = req.body.areas;
    if (!Array.isArray(areas)) {
      return res.send({ status: 'invalid' });
    }
    return async.series([
      lockSanitizeAndSaveAreas,
      unlockAll
    ], function(err) {
      if (err) {
        return res.send({ status: (typeof (err) === 'string') ? err : 'error' });
      }
      return res.send({ status: 'ok' });
    });

    function lockSanitizeAndSaveAreas(callback) {
      return async.eachSeries(areas, function(areaInfo, callback) {
        return self.lockSanitizeAndSaveArea(req, areaInfo, function(err) {
          // An error here is nonfatal because we want to give
          // other areas a chance to save if, for instance, another
          // user stole a lock on just one of them
          if (err) {
            self.apos.utils.error(err);
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

  // Render an editor for a virtual area with the content
  // specified as an array of items by the req.body.content
  // property, if any. The area will not attempt to save itself periodically.
  //
  // Used to implement editing of areas within schemas.

  self.route('post', 'edit-virtual-area', function(req, res) {
    var items = req.body.items || [];
    var options = req.body.options || {};
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
        self.apos.utils.error(err);
        res.statusCode = 500;
        return res.send('error');
      }
      // This template is a shim to call the
      // apos.area helper
      return res.send(self.render(req, 'virtualArea', { options: options }));
    });

  });

  // Render a view of the widget specified by req.body.data (which contains its
  // properties) and req.body.options (treated as if they were passed to it via
  // aposSingleton). req.body.type specifies the widget type. It is assumed that
  // the widget is editable and should be rendered with contextual editing controls
  // if it supports them.

  self.route('post', 'render-widget', function(req, res) {
    var originalData = (typeof (req.body.originalData) === 'object') ? req.body.originalData : {};
    var data = (typeof (req.body.data) === 'object') ? req.body.data : {};
    var options = (typeof (req.body.options) === 'object') ? req.body.options : {};
    var type = launder.string(req.body.type);
    var widget;
    var html;
    if (!(data && options && type)) {
      return fail(new Error('invalid'));
    }
    var manager = self.getWidgetManager(type);
    if (!manager) {
      self.warnMissingWidgetType(type);
      return fail(new Error('invalid'));
    }
    if (!self.apos.utils.isBlessed(req, options, 'widget', type)) {
      return fail('The widget options are not blessed. Usually this means you are\n' +
          'editing the same widget both contextually and in a dialog box, and\n' +
          'you are not passing the same widget options in index.js and in the\n' +
          'template, or you are not passing the widget options in index.js\n' +
          'at all. Either set the area to contextual: true, which keeps it\n' +
          'out of the dialog box, or set the "widgets" option to match the\n' +
          'last argument to "apos.area" in your template.\n\n' +
          'unblessed: ' + type + ', ' + JSON.stringify(options, null, '  '));
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
        return self.renderWidget(req, type, widget, options, function(err, _html) {
          if (err) {
            return callback(err);
          }
          html = _html;
          return callback(null);
        });
      }
    }, function(err) {
      if (err) {
        return fail(err);
      }
      return res.send(html);
    });
    function fail(err) {
      self.apos.utils.error(err);
      res.statusCode = 404;
      return res.send('notfound');
    }
  });

  // Supplies static DOM templates to the editor on request
  self.route('post', 'editor', function(req, res) {
    return res.send(self.render(req, 'editor'));
  });

};
