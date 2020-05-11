// Provides the "raw HTML widget" (the `apostrophe-html` widget).
// Use of this widget is not recommended if it can be avoided. The
// improper use of HTML can easily break pages. If a page becomes
// unusable, add `?safe_mode=1` to the URL to make it work temporarily
// without the offending code being rendered.

var _ = require('@sailshq/lodash');

module.exports = {
  extend: 'apostrophe-widgets',

  label: 'Raw HTML',

  beforeConstruct: function(self, options) {
    var addFields = [
      {
        type: 'string',
        name: 'code',
        label: 'Raw HTML (Code)',
        textarea: true,
        help: 'Be careful when embedding third-party code, as it can break the website editing functionality. If a page becomes unusable, add "?safe_mode=1" to the URL to make it work temporarily without the problem code being rendered.'
      }
    ];

    var arrangeFields = [
      {
        name: 'basics',
        label: 'Basics',
        fields: ['code']
      }
    ];

    options.arrangeFields = arrangeFields.concat(options.addFields || []);
    options.addFields = addFields.concat(options.addFields || []);
  },
  afterConstruct: function(self) {
    self.addHelper();
  },
  construct: function(self, options) {
    self.addHelper = function() {
      self.addHelpers({
        safeRender: self.safeRender
      });
    };

    self.safeRender = function(code) {
      var req = self.apos.templates.contextReq;
      if (req.xhr) {
        return 'Refresh the page to view raw HTML.';
      }
      // Be understanding of the panic that is probably going on in a user's mind as
      // they try to remember how to use safe mode. -Tom
      var safeModeVariations = [ 'safemode', 'safeMode', 'safe_mode', 'safe-mode', 'safe mode' ];
      if (req.query) {
        var safe = false;
        _.each(safeModeVariations, function(variation) {
          if (_.has(req.query, variation)) {
            safe = true;
            return false;
          }
        });
        if (safe) {
          return 'Running in safe mode, not showing raw HTML.';
        }
      }
      return code;
    };
  }
};
