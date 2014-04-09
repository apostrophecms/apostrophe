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
	};
};
