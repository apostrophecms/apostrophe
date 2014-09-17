var async = require('async');

module.exports = function(self, callback) {
  var collectionsToEmpty = ['pages','files','videos'];

  async.eachSeries(collectionsToEmpty, function(collection, callback){
    return self[collection].remove({ trash: true }, callback);
  }, callback);
};
