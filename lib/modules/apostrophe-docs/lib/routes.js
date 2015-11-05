module.exports = function(self, options) {
  self.route('post', 'autocomplete', function(req, res) {
    var data = req.body;
    return self.autocomplete(req, data, function(err, response) {
      if (err) {
        res.statusCode = 500;
        return res.send('error');
      }
      return res.send(
        JSON.stringify(response)
      );
    });
  });
};
