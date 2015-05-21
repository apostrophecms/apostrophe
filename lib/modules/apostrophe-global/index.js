// Always provide req.data.global, a virtual page
// for sitewide content such as a footer displayed on all pages

module.exports = {
  construct: function(self, options) {
    self.pageServe = function(req, callback) {
      return self.apos.docs.find(req, { slug: 'global' })
        .permission(false).toObject(function(err, doc) {
        if (err) {
          return callback(err);
        }
        req.data.global = doc ? doc : {
          slug: 'global',
          _edit: true
        };
        return callback(null);
      });
    };
  }
}
