var _ = require('lodash');
var async = require('async');
// Same engine used by express to match paths
var pathToRegexp = require('path-to-regexp');

module.exports = function(self, options) {

  self.rules = {};

  self.dispatch = function(pattern /* , middleware..., handler */) {
    var keys = [];
    var regexp;
    regexp = pathToRegexp(pattern, keys);
    self.rules[pattern] = {
      pattern: pattern,
      middleware: Array.prototype.slice.call(arguments, 1, arguments.length - 1),
      handler: arguments[arguments.length - 1],
      regexp: regexp,
      keys: keys
    };
  };

  self.pageServe = function(req, callback) {
    if (!req.data.bestPage) {
      return setImmediate(callback);
    }
    if (req.data.bestPage.type !== self.name) {
      return setImmediate(callback);
    }
    var rule;
    var params;
    var matched;

    _.each(self.rules, function(_rule) {
      if (self.match(req, _rule, req.remainder)) {
        matched = _rule;
        return false;
      }
    });
    if (!matched) {
      req.notfound = true;
      return callback(null);
    }

    // We have a match, so consider bestPage to be the
    // current page for template purposes
    req.data.page = req.data.bestPage;

    return async.eachSeries(matched.middleware, function(fn, callback) {
      return fn(req, stop, callback);
    }, afterMiddleware);

    function stop(err) {
      return callback(err);
    }

    function afterMiddleware() {
      return matched.handler(req, callback);
    }
  };

  self.match = function(req, rule, url) {
    var matches = rule.regexp.exec(url);
    if (!matches) {
      return false;
    }
    req.params = {};
    var i;
    for (i = 0; (i < rule.keys.length); i++) {
      req.params[rule.keys[i].name] = matches[i + 1];
    }
    return true;
  };
};
