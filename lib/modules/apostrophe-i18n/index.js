// This module makes an instance of the [i18n](https://npmjs.org/package/i18n) npm module available
// as `apos.i18n`. Apostrophe also makes this available in Nunjucks templates via the
// usual `__ns('apostrophe', )` helper function. Any options passed to this module are passed on to `i18n`.
//
// By default i18n locale files are generated in the `locales` subdirectory of the project.
//
// ## Options
//
// `localesDir`: if specified, the locale `.json` files are stored here, otherwise they
// are stored in the `locales` subdirectory of the project root.

var _ = require('@sailshq/lodash');
var importFresh = require('import-fresh');

module.exports = {
  afterConstruct: function(self) {
    self.namespaces = {
      'default': self.getI18nModule('default')
    };
    // For bc
    self.apos.i18n = self.namespaces['default'];
  },
  construct: function(self, options) {
    self.getI18nModule = function(namespace) {
      var i18n = importFresh('i18n');
      var i18nOptions;
      if (options.namespace && options.namespace[namespace]) {
        i18nOptions = options.namespace[namespace];
      } else {
        i18nOptions = _.clone(self.options || {});
      }
      _.defaults(i18nOptions, {
        locales: [ 'en' ],
        cookie: self.apos.shortName + '.locale',
        directory: self.getLocalesDir(namespace)
      });
      i18n.configure(i18nOptions);
      console.log(_.omit(i18nOptions, 'apos'));
      return i18n;
    };
    self.getLocalesDir = function(namespace) {
      if (namespace === 'default') {
        return self.options.localesDir || (self.apos.rootDir + '/locales');
      } else {
        return self.apos.rootDir + '/' + namespace + '-locales';
      }
    };
  }
};
