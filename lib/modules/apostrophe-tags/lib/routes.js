module.exports = function(self, options) {
  self.createRoutes = function() {
    self.route('post', 'manager', self.routes.manager);
    // self.route('post', )
  };

  self.routes = {};

  self.routes.list = function(req, res) {
    var data = {};
    return async.series({
      before: function(callback) {
        return self.beforeList(req, callback);
      },
      list: function(callback) {
        return self.list(req, function(err, results) {
          if (err) {
            return callback(err);
          }
          data.results = results;
          return callback();
        });
      },
      after: function(callback) {
        return self.afterList(req, callback);
      }
    }, function(err) {
      if (err) {
        return res.send({ status: 'error' });
      }
      return res.send({ status: 'ok', data: data });
    });
  };

  self.routes.manager = function(req, res) {
    return res.send(self.render(req, 'manager', { options: self.options }));
  };
}
