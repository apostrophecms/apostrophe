module.exports = function(self, options) {

  self.routes = {};

  self.createRoutes = function() {
    self.route('post', 'arrayEditor',  self.routes.arrayEditor);
    self.route('post', 'arrayItems',  self.routes.arrayItems);
    self.route('post', 'arrayItem',  self.routes.arrayItem);
  }

  self.routes.arrayEditor = function(req, res) {
    return res.send(self.render(req, 'arrayEditor', req.body));
  };

  self.routes.arrayItems = function(req, res) {
    return res.send(self.render(req, 'arrayItems', req.body));
  };

  self.routes.arrayItem = function(req, res) {
    return res.send(self.render(req, 'arrayItem', req.body));
  };
}
