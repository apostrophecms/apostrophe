var _ = require('@sailshq/lodash');

module.exports = {

  extend: 'apostrophe-pieces-cursor',

  construct: function(self, options) {

    self.addFilter('minSize', {
      finalize: function() {
        var minSize = self.get('minSize');
        if (!minSize) {
          return;
        }
        var $nin = _.filter(_.keys(self.apos.attachments.sized), function(key) {
          return self.apos.attachments.sized[key];
        });
        var criteria = {
          $or: [
            {
              'attachment.extension': { $nin: $nin }
            },
            {
              'attachment.width': { $gte: minSize[0] },
              'attachment.height': { $gte: minSize[1] }
            }
          ]
        };
        self.and(criteria);
      },
      safeFor: 'public',
      launder: function(a) {
        if (!Array.isArray(a)) {
          return undefined;
        }
        if (a.length !== 2) {
          return undefined;
        }
        return [ self.apos.launder.integer(a[0]), self.apos.launder.integer(a[1]) ];
      }
    });

  }

};
