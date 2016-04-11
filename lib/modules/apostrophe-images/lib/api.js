var async = require('async');
var _ = require('lodash');

module.exports = function(self, options) {

  var superFind = self.find;
  self.find = function(req, criteria, projection) {
    console.log('in images find');
    var cursor = superFind(req, criteria, projection);
    require('./cursor.js')(self, cursor);
    return cursor;
  };

};
