module.exports = {
  extend: 'apostrophe-widgets',

  label: 'Raw HTML',

  beforeConstruct: function(self, options) {
    options.addFields = options.addFields || [
      {
        type: 'string',
        name: 'code',
        label: 'Raw HTML (Code)',
        textarea: true
      }
    ]
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
      if (req.query && req.query.safeMode) {
        return 'Running in safe mode, not showing raw HTML.';
      }
      return code;
    };
  }
}
