// Cursor for fetching pieces.
//
// ## Options
//
// *Note that `find` does not take an options argument. Instead these
// options are usually configured in subclasses or their `beforeConstruct` methods.*
//
// ### `sort`
// The default sort. Defaults to:
//
// ```javascript
// {
//  updatedAt: -1
// }
// ```

module.exports = {
  extend: 'apostrophe-doc-type-manager-cursor',
  afterConstruct: function(self) {
    self.defaultSort(self.options.module.options.sort || { updatedAt: -1 });
  }
};
