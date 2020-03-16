module.exports = {
  init(self, options) {
    // Set property
    self.color = 'red';

    // Attach to apos
    self.apos.test = self;
  }
};
