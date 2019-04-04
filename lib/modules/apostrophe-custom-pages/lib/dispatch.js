var _ = require('@sailshq/lodash');
var async = require('async');
// Same engine used by express to match paths
var pathToRegexp = require('path-to-regexp');

module.exports = function(self, options) {

  self.rules = {};

  // Add an Express-style route that responds when "the rest" of the URL, beyond
  // the page slug itself, matches a pattern.
  //
  // For instance,  if the page slug is `/poets`, the URL is
  // `/poets/chaucer`, and this method has been called with
  // `('/:poet', self.poetPage)`, then the `poetPage` method will
  // be invoked with `(req, callback)`.
  //
  // **Special case:** if the page slug is simply `/poets` (with no slash) and
  // there is a dispatch route with the pattern `/`, that route will be invoked.
  //
  // Dispatch routes can also have middleware. Pass middleware functions as
  // arguments in between the pattern and the handler. Middleware is invoked
  // with `(req, stop, callback)`. If your middleware wishes to prevent the
  // handler from being invoked, call `stop(null)` rather than `callback(null)`.
  // Otherwise the chain of middleware continues and, at the end, the handler is invoked.

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

  // Called for us by `apostrophe-pages` when any page is accessed.
  // Checks first to make sure that the page that best matches the longest
  // prefix of the URL (`req.data.bestPage`) is of the appropriate type
  // for this module. If so, the remainder of the URL is compared to the
  // dispatch routes that have been added via the `dispatch` method, and
  // the appropriate route, if any, is invoked, with `req.data.page` being set.
  //
  // If there are no matches, a 404 not found response occurs.
  //
  // If there are no dispatch routes for this module, an exact match of
  // the URL sets `req.data.page`, otherwise a 404 not found response occurs.

  self.pageServe = function(req, callback) {
    if (!req.data.bestPage) {
      return setImmediate(callback);
    }
    if (req.data.bestPage.type !== self.name) {
      return setImmediate(callback);
    }

    var matched;

    if (_.isEmpty(self.rules)) {
      // If there are no dispatch rules, assume this is an "ordinary" page type and
      // just look for an exact match
      if (req.remainder !== '/') {
        req.notFound = true;
      } else {
        self.acceptResponsibility(req);
      }
      return callback(null);
    }

    _.each(self.rules, function(_rule) {
      if (self.match(req, _rule, req.remainder)) {
        matched = _rule;
        return false;
      }
    });
    if (!matched) {
      req.notFound = true;
      return callback(null);
    }

    self.acceptResponsibility(req);

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

  // Match a URL according to the provided rule as registered
  // via the dispatch method. If there is a match, `req.params` is
  // set exactly as it would be by Express and `true` is returned.
  // Invoked by the `pageServe` method.

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

  // Called by `pageServe`. Accepts responsibility for
  // the current URL by assigning `req.data.bestPage` to
  // `req.page` and implementing the `scene` option, if set
  // for this module.

  self.acceptResponsibility = function(req) {
    // We have a match, so consider bestPage to be the
    // current page for template purposes
    req.data.page = req.data.bestPage;
    if (self.options.scene) {
      req.scene = self.options.scene;
    }
  };
};
