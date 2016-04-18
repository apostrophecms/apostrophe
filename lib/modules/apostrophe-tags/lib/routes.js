module.exports = function(self, options) {
  self.createRoutes = function() {
    self.route('post', 'manager', self.routes.manager);
  };

  self.routes = {};

  self.routes.manager = function(req, res) {
    return res.send(self.render(req, 'manager', { options: self.options }));
  }
}
