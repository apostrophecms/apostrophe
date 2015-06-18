module.exports = function(self, options) {
  self.route('all', 'autocomplete', function(req, res) {
    var data = (req.method === 'POST') ? req.body : req.query;
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
