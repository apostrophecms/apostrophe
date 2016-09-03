// This module provides a special doc type manager for the `apostrophe-page` type, which
// actually refers to any page in the tree, regardless of type. This
// allows you to create [apostrophe-schemas](Apostrophe schema joins) that can link to
// any page in the page tree, rather than one specific page type.

var _ = require('lodash');

module.exports = {

  extend: 'apostrophe-doc-type-manager',

  // Never actually found
  name: 'apostrophe-page',

  construct: function(self, options) {
    // Return a cursor for finding pages of any type (but only pages, never pieces).
    // `apostrophe-pages-cursor` takes care of ensuring that pieces don't creep in.
    self.find = function(req, criteria, projection) {
      return self.apos.create('apostrophe-pages-cursor', {
        apos: self.apos,
        req: req,
        criteria: criteria,
        projection: projection
      });
    };
  }
};
