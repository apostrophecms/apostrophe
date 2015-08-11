var _ = require('lodash');

module.exports = function(self, options) {

  self.route('post', 'upload', self.apos.middleware.files, function(req, res) {
    // Must use text/plain for file upload responses in IE <= 9,
    // doesn't hurt in other browsers. -Tom
    res.header("Content-Type", "text/plain");
    // The name attribute could be anything because of how fileupload
    // controls work; we don't really care.
    var file = _.values(req.files || {})[0];
    if (!file) {
      return res.send({ status: 'notfound' });
    }
    return self.accept(req, file, function(err, files) {
      if (err) {
        console.error(err);
        return res.send({ status: 'err' });
      }
      if(req.query.html) {
        res.setHeader('Content-Type', 'text/html');
      }
      return res.send({ file: file, status: 'ok' });
    });
  });

}
