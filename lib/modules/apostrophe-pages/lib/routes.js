module.exports = function(self, options) {
  self.route('get', 'new', function(req, res) {
    var def = self.typeChoices[0];
    var manager = self.apos.docs.getManager(def.name);
    return res.send(self.render(req, 'new', { schema: manager.schema }));
  });
};

