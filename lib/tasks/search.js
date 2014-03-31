var async = require('async');
var _ = require('lodash');
var argv = require('optimist').argv;

// Add search page if missing

module.exports = function(self, callback) {
  console.log('Adding a search page to the site');
  self.pages.findOne({ type: 'search' }, function (err, search) {
    if (err) {
      return callback(err);
    }
    if (!search) {
      console.log('No search page, adding it');
      return self.insertSystemPage({
          _id: 'search',
          path: 'home/search',
          slug: '/search',
          type: 'search',
          title: 'Search',
          published: true,
          // Max home page direct kids on one site: 1 million. Max special
          // purpose admin pages: 999. That ought to be enough for
          // anybody... I hope!
          rank: 1000998
      }, callback);
    } else {
      console.log('We already have one');
    }
    return callback(null);
  });
};
