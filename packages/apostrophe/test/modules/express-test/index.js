module.exports = {
  routes(self) {
    return {
      get: {
        '/tests/welcome': (req, res) => {
          res.send('ok');
        }
      },
      post: {
        '/tests/body': (req, res) => {
          res.send(req.body.person.age);
        }
      }
    };
  }
};
