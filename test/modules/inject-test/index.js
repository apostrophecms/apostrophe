module.exports = {
  init(self) {
    self.apos.template.prepend('head', 'inject-test:prependHeadTest');
    self.apos.template.append('head', 'inject-test:appendHeadTest');
    self.apos.template.append('body', 'inject-test:appendBodyTest');
  },
  components(self) {
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
