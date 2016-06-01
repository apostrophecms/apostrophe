module.exports = {

  extend: 'apostrophe-pieces-cursor',

  construct: function(self, options) {

    self.addFilter('minSize', {
      finalize: function() {
        var minSize = self.get('minSize');
        if (!minSize) {
          return;
        }
        var criteria = {};
        criteria['attachment.width'] = { $gte: minSize[0] };
        criteria['attachment.height'] = { $gte: minSize[1] };
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
