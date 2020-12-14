module.exports = {
  init(self, options) {
    // TODO migrate everything in modules/@apostrophecms/asset/lib/globalIcons.js over to this?
    self.apos.asset.addIcon('earth-icon', 'Earth');
    self.apos.asset.addIcon('database-check-icon', 'DatabaseCheck');
  }
};
