module.exports = {
  routes(self, options) {
    return {
      get: {
        '/tests/welcome': (req, res) => {
          res.send('ok');
        },
        '/tests/body': (req, res) => {
          res.send(req.body.person.age);
        }
      }
    };
  }
};
