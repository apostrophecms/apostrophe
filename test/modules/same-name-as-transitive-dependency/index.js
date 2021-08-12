module.exports = {
  options: {
    alias: 'same',
    color: 'purple'
  },
  init(self) {
    self.color = self.options.color;
  }
};
