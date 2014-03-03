var _ = require('underscore');
var extend = require('extend');

 /**
 * i18n
 * @augments Augments the apos object with methods supporting i18n.
 * This is mostly to support frontend translation for things such as
 * page types, and other dynamically pushed peices of information
 */

module.exports = function(self) {
	self.pushLocaleStrings = function(obj, req){
	    if(req){
	    	req.pushCall('polyglot.extend(?)', obj);
	    } else {
	    	self.pushGlobalCallWhen('always', 'polyglot.extend(?)', obj);
	    }
	}

  	self.initI18nLocal = function (req, res) {
		self.addLocal('__', res.__);
	}
};
