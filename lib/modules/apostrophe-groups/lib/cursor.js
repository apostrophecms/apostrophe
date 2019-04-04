module.exports = {
  extend: 'apostrophe-pieces-cursor',
  afterConstruct: function(self) {
    // It is normal for groups to be unpublished (a backend feature only), so cursors
    // for groups shouldn't be picky by default
    self.published(null);
  }
};
