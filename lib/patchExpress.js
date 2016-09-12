// Patches necessary for Express 3 to function safely and reliably in a newer node environment

var encodeurl = require('encodeurl');

module.exports = function(self) {
  var superRedirect = self.app.response.redirect;
  self.app.response.redirect = function(status, url) {
    if (arguments.length === 1) {
      url = arguments[0];
      status = 302;
    }
    url = encodeurl(url);
    superRedirect.call(this, url);
  };
};
