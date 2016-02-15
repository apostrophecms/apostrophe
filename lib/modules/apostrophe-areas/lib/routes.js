var _ = require('lodash');
var async = require('async');

module.exports = function(self, options) {
  var launder = self.apos.launder;

  self.route('post', 'save-area', function(req, res) {
    var items = Array.isArray(req.body.items) ? req.body.items : [];
    var docId = launder.id(req.body.docId);
    var dotPath = launder.string(req.body.dotPath);
    var doc;
    if (!(items && options && docId && dotPath)) {
      return fail(new Error('invalid'));
    }
    if (!dotPath.match(/^[\w\.]+$/)) {
      return fail(new Error('invalid'));
    }
    return self.sanitizeItems(req, items, function(err, items) {
      if (err) {
        return fail(err);
      }
      return self.saveArea(req, docId, dotPath, items, function(err) {
        if (err) {
          return fail(err);
        }
        return res.send({ status: 'ok' });
      });
    });
    function fail(err) {
      console.error(err);
      return res.send({ status: 'error' });
    }
  });

  // Render an editor for a virtual area with the content
  // specified as an array of items by the req.body.content
  // property, if any. For use when you are supplying your own storage
  // (for instance, the blog module uses this to render
  // an area editor for the content of a post).

  self.route('post', 'edit-virtual-area', function(req, res) {
    var items = req.body.items || [];
    var options = req.body.options || {};
    var area = {
      type: 'area',
      items: items,
      _edit: true
    };
    // virtual option prevents attributes used to
    // save content from being output
    options.virtual = true;
    options.area = area;
    // This template is a shim to call the
    // apos.area helper
    return res.send(self.render(req, 'virtualArea', { options: options }));
  });


  // Render a view of the widget specified by req.body.data (which contains its
  // properties) and req.body.options (treated as if they were passed to it via
  // aposSingleton). req.body.type specifies the widget type. It is assumed that
  // the widget is editable and should be rendered with contextual editing controls
  // if it supports them.

  self.route('post', 'render-widget', function(req, res) {
    var data = (typeof(req.body.data) === 'object') ? req.body.data : {};
    var options = (typeof(req.body.options) === 'object') ? req.body.options : {};
    var type = launder.string(req.body.type);
    if (!(data && options && type)) {
      return fail(new Error('invalid'));
    }
    var manager = self.getWidgetManager(type);
    if (!manager) {
      return fail(new Error('invalid'));
    }
    if (!self.apos.utils.isBlessed(req, options, 'widget', type)) {
      return fail(new Error('unblessed'));
    }
    var widget;
    return async.series({
      sanitize: function(callback) {
        return manager.sanitize(req, data, function(err, _widget) {
          if (err) {
            return callback(err);
          }
          widget = _widget;
          widget._edit = true;
          return callback(null);
        });
      },
      load: function(callback) {
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
      console.error(err);
      res.statusCode = 404;
      return res.send('notfound');
    }
  });

  // Supplies static DOM templates to the editor on request
  self.route('post', 'editor', function(req, res) {
    return res.send(self.render(req, 'editor'));
  });

};
