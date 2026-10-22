module.exports = {
  bundle: {
    modules: [ 'test-bundle-sub' ],
    directory: 'modules'
  },
  init(self) {
    // Set property
    self.color = 'red';

    // Attach to apos
    self.apos.test = self;
  }
};
