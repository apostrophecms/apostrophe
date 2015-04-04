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
};
