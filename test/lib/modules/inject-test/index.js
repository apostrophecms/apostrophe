module.exports = {
  init(self, options) {
    self.apos.templates.prepend('head', 'inject-test:prependHeadTest');
    self.apos.templates.append('head', 'inject-test:appendHeadTest');
    self.apos.templates.append('body', 'inject-test:appendBodyTest');
  },
  components(self, options) {
    return {
      prependHeadTest(req, data) {
        return data;
      },
      appendHeadTest(req, data) {
        return data;
      },
      appendBodyTest(req, data) {
        return data;
      }
    };
  }
};
