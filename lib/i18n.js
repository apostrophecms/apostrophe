var _ = require('lodash');
var extend = require('extend');
var i18n = require('i18n');

 /**
 * i18n
 * @augments Augments the apos object with methods supporting i18n.
 * This is mostly to support frontend translation for things such as
 * page types, and other dynamically pushed peices of information
 */

module.exports = function(self) {
	self.pushLocaleStrings = function(obj, req) {
    if (req) {
    	req.pushCall('polyglot.extend(?)', obj);
    } else {
    	self.pushGlobalCallWhen('always', 'polyglot.extend(?)', obj);
    }
	};

  self.initI18nLocal = function (req) {
    self.addLocal('__', req.res.__);
    // Debugging aid...
		// self.addLocal('__', function(a) {
    // console.log(arguments);
    // return '[' + req.res.__(a) + ']';
    // });
		self.addLocal('getLocale', function() {
		    return req.locale;
		});
		// This is useful in building internationalization links, and generally.
    // Remove any apos_refresh parameter, as what we universally want in a
    // template is the full page URL
		self.addLocal('getUrl', function() {
      var urls = require('url');
      var parsed = urls.parse(req.url, true);
      delete parsed.search;
      delete parsed.query.apos_refresh;
			return urls.format(parsed);
		});
	};
};
