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
//
// `namespaces`: if set to `true`, the translation key is prefixed like this
// so that translation teams can tell the difference between Apostrophe's
// UI phrases and your own phrases:
//
// "apostrophe<:>Phrase Here"
//
// The separator was chosen to be unlikely to be part of your actual text,
// but you can change the separator with the `namespaceOperator` option.
//
// ## Namespacing your own i18n calls
//
// You can optionally namespace your own i18n calls by invoking
// `__ns('namespace', 'phrase')` rather than `__('phrase')`,
// `__ns_n` rather than `__n`, etc.
//
// Currently the namespaced wrapper calls only support being invoked with a key as the
// second argument. Other variations are not supported with namespaces.
//
// *If you are using the `objectNotation` option to i18n, do not use your
// objectNotation separator character in a namespace name.*

var _ = require('@sailshq/lodash');
var i18n = require('i18n');

module.exports = {

  construct: function(self, options) {

    var i18nOptions = self.options || {};
    _.defaults(i18nOptions, {
      locales: [ 'en' ],
      cookie: self.apos.shortName + '.locale',
      directory: self.options.localesDir || (self.apos.rootDir + '/locales')
    });

    var superConfigure = i18n.configure;
    i18n.configure = function(i18nOptions) {
      if (!self.options.namespaceSeparator) {
        if (i18nOptions.objectNotation) {
          // With object notation a : in our separator breaks i18n
          self.namespaceSeparator = '<@>';
        } else {
          // For bc with previous release when not using object notation
          self.namespaceSeparator = '<:>';
        }
        self.objectNotation = i18nOptions.objectNotation;
      } else {
        self.namespaceSeparator = self.options.namespaceSeparator;
      }
      return superConfigure.call(i18n, i18nOptions);
    };

    i18n.configure(i18nOptions);
    const operators = {
      '__ns': '__',
      '__ns_n': '__n',
      '__ns_mf': '__mf',
      '__ns_l': '__l',
      '__ns_h': '__h'
    };
    _.each(operators, function(to, from) {
      i18n[from] = function(namespace, key /* etc */) {
        var prefixed;
        var prefixLength;
        var prefix;
        var objectNotationChar;
        if (self.options.namespaces && ((typeof key) === 'string')) {
          prefix = namespace + self.namespaceSeparator;
          prefixed = prefix + key;
          arguments[1] = prefixed;
        }
        if (self.objectNotation) {
          // We do not use object notation in the standard modules (apostrohe
          // namespace), but use of . or : in the key will be treated as such,
          // causing errors and misdisplay of the UI. Work around this by
          // substituting for ":" (the key/default separator for object notation)
          // and "." (or the configured objectNotation character)
          if (namespace === 'apostrophe') {
            // Replace : with U+FE55 SMALL COLON
            key = key.replace(/:/g, '﹕');
            objectNotationChar = (self.objectNotation !== true) ? self.objectNotation : '.';
            // Replace . or chosen separator with U+FE52 SMALL PERIOD
            key = key.replace(new RegExp(self.apos.utils.regExpQuote(objectNotationChar), 'g'), '﹒');
          }
        }
        // `this` will typically be req or res at this point and that's important because
        // i18n looks at it to figure out what the locale is, so it is correct to pass it
        // to apply
        let result = i18n[to].apply(this, Array.prototype.slice.call(arguments, 1));
        if (self.options.namespaces && prefix && ((typeof result) === 'string')) {
          prefixLength = prefix.length;
          if (result.substring(0, prefixLength) === prefix) {
            // No translation available, so it came straight through. Undo the prefixing
            result = result.substring(prefixLength);
          }
        }
        if (self.objectNotation && (namespace === 'apostrophe')) {
          return result.replace(/﹕/g, ':').replace(/﹒/g, objectNotationChar);
        } else {
          return result;
        }
      };
    });

    // Make the i18n instance available globally in Apostrophe
    self.apos.i18n = i18n;

    self.namespacesMiddleware = function(req, res, next) {
      // Implementation is above, we just need to bind it
      const operators = [ '__ns', '__ns_n', '__ns_mf', '__ns_l', '__ns_h' ];
      const targets = [ req, res ];
      _.each(targets, function(target) {
        _.each(operators, function(operator) {
          target[operator] = i18n[operator];
        });
      });
      return next();
    };
  }
};
