var lessMiddleware = require('less-middleware');
var path = require('path');

/**
 * static
 * @augments Augments the apos object with resources supporting the serving of static content
 */

module.exports = function(self) {
  var lessMiddlewares = {};

  /**
   * static returns a route function for use as a route that
   * serves static files from a folder. This is helpful when writing
   * your own modules that extend apos and need to serve their own static
   * assets:
   *
   * self.app.get('/apos-twitter/*', apos.static(__dirname + '/../public'))
   *
   * Because self.static is suitable for use as a route rather
   * than as global middleware, it is easier to set it up for many
   * separate modules.
   * @param  {String} dir The local folder to serve content from
   * @return {Function} An Express route function to be passed to app.get() as the second argument
   */
  self.static = function(dir) {
    dir = path.normalize(dir);
    return function(req, res) {
      var path = req.params[0];
      // Don't let them peek at /etc/passwd etc. Browsers
      // pre-resolve these anyway
      path = path.replace(/\.\./g, '');
      // Otherwise the middleware looks in the wrong place
      req.url = path;
      if (!lessMiddlewares[dir]) {
        lessMiddlewares[dir] = lessMiddleware({
            src: dir,
            compress: true
        });
      }
      var middleware = lessMiddlewares[dir];
      middleware(req, res, function() {
        return res.sendfile(dir + '/' + path);
      });
    };
  };
};

