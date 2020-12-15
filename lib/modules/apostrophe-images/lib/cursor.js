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

    self.addFilter('orientation', {
      finalize: function() {
        const orientation = self.get('orientation');
        if (!orientation) {
          return;
        }

        self.and(getCriteria(orientation));

        function getCriteria(orient) {
          if (orient === 'landscape') {
            return {'attachment.landscape': true};
          } else if (orient === 'portrait') {
            return {'attachment.portrait': true};
          }

          // Last case is square
          return {
            'attachment.square': true
          };
        }
      },
      safeFor: 'public',
      launder: function(s) {
        return self.apos.launder.string(s);
      },
      choices: function(callback) {
        const {choices} = options.module.filters
          .find((filter) => filter.name === 'orientation');

        return callback(null, choices);
      }
    });

    self.addFilter('fileType', {
      finalize: function() {
        const fileType = self.get('fileType');
        if (!fileType) {
          return;
        }

        const criteria = {
          'attachment.extension': fileType
        };

        self.and(criteria);
      },
      safeFor: 'public',
      launder: function(s) {
        return self.apos.launder.string(s);
      },
      choices: function(callback) {
        const {choices} = options.module.filters
          .find((filter) => filter.name === 'fileType');

        return callback(null, choices);
      }
    });

  }

};
