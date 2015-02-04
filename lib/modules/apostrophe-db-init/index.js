var mongo = require('mongodb');

module.exports = {
  construct: function(self, options, callback) {
    // Open the database connection. Always use MongoClient with its
    // sensible defaults. Build a URI if we need to so we can call it
    // in a consistent way

    var uri = 'mongodb://';
    if (options.uri) {
      uri = options.uri;
    } else {
      if (options.user) {
        uri += options.user + ':' + options.password + '@';
      }
      if (!options.host) {
        options.host = 'localhost';
      }
      if (!options.port) {
        options.port = 27017;
      }
      uri += options.host + ':' + options.port + '/' + options.name;
    }
    return mongo.MongoClient.connect(uri, function (err, dbArg) {
      self.apos.db = dbArg;
      return callback(err);
    });
  }
};
