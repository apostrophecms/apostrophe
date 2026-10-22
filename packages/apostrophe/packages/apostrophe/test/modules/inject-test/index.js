module.exports = {
  init(self) {
    self.apos.template.prepend('head', 'inject-test:prependHeadTest');
    self.apos.template.append('head', 'inject-test:appendHeadTest');
    self.apos.template.append('body', 'inject-test:appendBodyTest');

    // Should not succeed
    self.apos.template.append({
      where: 'head',
      component: 'inject-test:appendDevViteTest',
      when: 'dev',
      bundler: 'vite'
    });
    self.apos.template.append({
      where: 'head',
      component: 'inject-test:appendProdWebpackTest',
      when: 'prod',
      bundler: 'webpack'
    });
    self.apos.template.prepend({
      where: 'head',
      component: 'inject-test:prependProdTest',
      when: 'prod'
    });
    // The alternative syntax should work
    self.apos.template.prepend('head', 'inject-test:prependDevViteTest', {
      when: 'dev',
      bundler: 'vite'
    });
    self.apos.template.prepend('head', 'inject-test:prependViteTest', {
      bundler: 'vite'
    });

    // Should succeed
    self.apos.template.prepend({
      where: 'head',
      component: 'inject-test:prependDevTest',
      when: 'dev'
    });
    // The alternative syntax should work
    self.apos.template.append('head', 'inject-test:appendDevWebpackTest', {
      when: 'dev',
      bundler: 'webpack'
    });
    self.apos.template.append('head', 'inject-test:appendDevTest', {
      when: 'dev'
    });
    self.apos.template.prepend({
      where: 'head',
      component: 'inject-test:prependDevWebpackTest',
      when: 'dev',
      bundler: 'webpack'
    });
    self.apos.template.prepend('head', 'inject-test:prependWebpackTest', {
      bundler: 'webpack'
    });
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
      },
      appendDevViteTest(req, data) {
        return data;
      },
      appendProdWebpackTest(req, data) {
        return data;
      },
      prependProdTest(req, data) {
        return data;
      },
      prependDevViteTest(req, data) {
        return data;
      },
      prependViteTest(req, data) {
        return data;
      },
      prependDevTest(req, data) {
        return data;
      },
      appendDevWebpackTest(req, data) {
        return data;
      },
      appendDevTest(req, data) {
        return data;
      },
      prependDevWebpackTest(req, data) {
        return data;
      },
      prependWebpackTest(req, data) {
        return data;
      }
    };
  }
};
