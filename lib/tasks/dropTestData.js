var async = require('async');
var _ = require('lodash');
var argv = require('optimist').argv;

// Drop test data

module.exports = function(self, callback) {
  console.log('Dropping all test data.');
  return self.pages.remove({ testData: true }, callback);
};
