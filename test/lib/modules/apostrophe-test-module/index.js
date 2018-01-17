module.exports = {
  construct: function(self, options) {
    // Set property
    self.color = 'red';

    // Attach to apos
    self.apos.test = self;
  }
};
