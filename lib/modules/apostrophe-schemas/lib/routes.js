var async = require('async');
var _ = require('@sailshq/lodash');

module.exports = function(self, options) {

  self.routes = {};

  self.createRoutes = function() {
    self.route('post', 'arrayEditor', self.routes.arrayEditor);
    self.route('post', 'arrayItems', self.routes.arrayItems);
    self.route('post', 'arrayItem', self.routes.arrayItem);
  };

  self.routes.arrayEditor = function(req, res) {
    return self.renderAndSend(req, 'arrayEditor', req.body);
  };

  self.routes.arrayItems = function(req, res) {
    // Sanitize and join array items so that it is possible to
    // utilize deeply nested data when rendering titles
    req.tolerantSanitization = true;
    if (!self.apos.utils.isBlessed(req, req.body.field, 'array')) {
      self.apos.utils.warn('unblessed array: ' + JSON.stringify(req.body.field, null, '  '));
      return self.apiResponder(req, 'invalid');
    }
    var receptacle = {};
    var source = {};
    var name = req.body.field.name;
    var active = self.apos.launder.integer(req.body.active);
    source[name] = req.body.arrayItems;
    var field = req.body.field;
    return async.series([ convert, join ], function(err) {
      if (err) {
        return self.apiResponder(req, err);
      }
      if (Array.isArray(req.body.arrayItems)) {
        _.each(receptacle[name], function(item, i) {
          item._ordinal = self.apos.launder.integer(req.body.arrayItems[i]._ordinal);
        });
      }
      _.each(receptacle[name], function(item) {
        if (field.titleField && _.get(item, field.titleField)) {
          item._title = _.get(item, field.titleField);
        } else {
          item._title = '#' + item._ordinal;
        }
      });
      return self.renderAndSend(req, 'arrayItems', { active: active, arrayItems: receptacle[name], field: req.body.field });
    });
    function convert(callback) {
      return self.fieldTypes['array'].converters.form(req, source, name, receptacle, req.body.field, callback);
    }
    function join(callback) {
      return self.join(req, [ req.body.field ], [ receptacle ], true, callback);
    }
  };

  self.routes.arrayItem = function(req, res) {
    return self.renderAndSend(req, 'arrayItem', req.body);
  };
};
