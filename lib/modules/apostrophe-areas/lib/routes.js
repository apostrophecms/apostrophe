var deep = require('deep-get-set');
var _ = require('lodash');

module.exports = function(self, options) {
  var launder = self.apos.launder;
  self.route('post', 'save-singleton', function(req, res) {
    var data = (typeof(req.body.data) === 'object') ? req.body.data : {};
    var options = (typeof(req.body.options) === 'object') ? req.body.options : {};
    var type = launder.string(options.type);
    var docId = launder.id(req.body.docId);
    var dotPath = launder.string(req.body.dotPath);
    var doc;
    if (!(type && data && options && docId && dotPath)) {
      return fail(new Error('invalid'));
    }
    if (!dotPath.match(/^[\w\.]+$/)) {
      return fail(new Error('invalid'));
    }
    console.error('TODO: validate widget data in save-singleton');
    return self.saveSingleton(req, docId, dotPath, data, options, function(err, html) {
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
    console.error('TODO: validate widget data in save-area');
    return self.saveArea(req, docId, dotPath, data, function(err) {
      if (err) {
        return fail(err);
      }
      return res.send({ status: 'ok' });
    });
    function fail(err) {
      console.error(err);
      return res.send({ status: 'error' });
    }
  });

  self.route('post', 'render-widget', function(req, res) {
    console.log('in render-widget');
    var data = (typeof(req.body.data) === 'object') ? req.body.data : {};
    var options = (typeof(req.body.options) === 'object') ? req.body.options : {};
    var type = launder.string(req.body.type);
    if (!(data && options && type)) {
      return fail(new Error('invalid'));
    }
    console.error('TODO: validate widget data in render-widget');
    return self.renderWidget(req, type, data, options, function(err, html) {
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
  // TODO: figure out how to do this as a GET without
  // introducing unwanted caching between deployments
  self.route('post', 'editor', function(req, res) {
    return res.send(self.render(req, 'editor'));
  });

};
