apos.define('apostrophe-images-widgets-editor', {
  extend: 'apostrophe-pieces-widgets-editor',
  construct: function(self, options) {
    var join = _.find(self.schema, { name: '_pieces' });
    if (join) {
      _.defaults(join, {
        hints: {}
      });
      _.defaults(join.hints, {
        limit: options.templateOptions.limit,
        minSize: options.templateOptions.minSize,
        focalPoint: options.templateOptions.focalPoint,
        aspectRatio: options.templateOptions.aspectRatio
      });
    }

    var superBeforeShow = self.beforeShow;

    self.beforeShow = function(callback) {
      return superBeforeShow(callback);
    };
  }
});
