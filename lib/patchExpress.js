// Patches necessary for Express 3 to function safely and reliably in a newer node environment

var encodeurl = require('encodeurl');

module.exports = function(self) {
  var superRedirect = self.app.response.redirect;
  self.app.response.redirect = function(url) {
    url = encodeurl(url);
    superRedirect.call(this, url);
  };
};
