apos.define('apostrophe-images-widgets-editor', {
  extend: 'apostrophe-pieces-widgets-editor',
  construct: function(self, options) {

    console.log(options.templateOptions);

    var join = _.find(self.schema, { name: '_pieces' });
    if (join) {
      _.defaults(join, {
        hints: {}
      });
      _.defaults(join.hints, {
        minSize: options.templateOptions.minSize,
        aspectRatio: options.templateOptions.aspectRatio
      });
    }

    var superBeforeShow = self.beforeShow;

    self.beforeShow = function(callback) {
      return superBeforeShow(callback);
    };
  }
});
