module.exports = function(self, options){
  self.route('get', 'new', function(req, res) {
    return res.send(self.render(req, 'new'));
  });
}
