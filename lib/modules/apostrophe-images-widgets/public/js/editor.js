apos.define('apostrophe-images-widgets-editor', {
  extend: 'apostrophe-pieces-widgets-editor',
  construct: function(self, options) {
    console.log('widgets editor');
    var join = _.find(self.schema, { name: '_pieces' });
    if (join) {
      _.defaults(join, {
        hints: {}
      });
      console.log('coming in the door:');
      console.log(options.templateOptions);
      _.defaults(join.hints, {
        limit: options.templateOptions.limit,
        minSize: options.templateOptions.minSize,
        focalPoint: options.templateOptions.focalPoint,
        aspectRatio: options.templateOptions.aspectRatio
      });
      console.log(join.hints);
    }

    var superBeforeShow = self.beforeShow;

    self.beforeShow = function(callback) {
      return superBeforeShow(callback);
    };
  }
});
