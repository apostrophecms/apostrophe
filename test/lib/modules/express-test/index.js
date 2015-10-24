module.exports = {
  construct: function(self, options) {

    // Simple GET route, mostly to establish CSRF token
    self.apos.app.get('/tests/welcome', function(req, res) {
      res.send('ok');
    });

    // Implement a route that replies with a nested property
    self.apos.app.post('/tests/body', function(req, res) {
      res.send(req.body.person.age);
    });

    // Use self.route to implement a similar route
    self.route('post', 'test2', function(req, res) {
      res.send(req.body.person.age);
    });

  }
};
