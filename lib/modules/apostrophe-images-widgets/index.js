// Implements widgets that display single images and slideshows.
//
// See [adding editable content to pages](/core-concepts/editable-content-on-pages/standard-widgets.md#apostrophe-images) for a thorough discussion of the options that can be passed to the widget.

var _ = require('@sailshq/lodash');

module.exports = {
  extend: 'apostrophe-pieces-widgets',
  label: 'Image(s)',
  beforeConstruct: function(self, options) {
    if (options.by === undefined) {
      // Default behavior for this widget is that you must handpick images.
      // Supporting "smart slideshows" powered by tags that also respect
      // the minSize filter is complicated because
      // their queries must take their template options into account, which is
      // a very deep design problem probably not readily solved without
      // mandating full schemas for pages. Plus, 99% of the time the extra
      // modal step is just confusing, which is the original reason I was
      // asked to bypass it here. -Tom
      options.by = [ 'id' ];
    }
    // Add a relationship with cropping coordinates to the join.
    // We don't have any opinion on other aspects of that join, so
    // use alterFields, and take care to call any alterFields function
    // provided downstream. -Tom
    var superAlterFields = options.alterFields || function(schema) {};
    options.alterFields = function(schema) {
      var join = _.find(schema, { name: '_pieces' });
      if (join) {
        join.relationshipsField = 'relationships';
        join.relationship = [
          // Cropping coordinates.
          //
          // These are nullable; if left is null there is no crop.
          {
            type: 'integer',
            def: null,
            name: 'left',
            label: 'Left'
          },
          {
            type: 'integer',
            def: null,
            name: 'top',
            label: 'Top'
          },
          {
            type: 'integer',
            def: null,
            name: 'width',
            label: 'Width'
          },
          {
            type: 'integer',
            def: null,
            name: 'height',
            label: 'Height'
          },
          // Focal point percentages.
          // These are nullable; if they are null there is no focal point.
          {
            type: 'float',
            def: null,
            name: 'x',
            label: 'X'
          },
          {
            type: 'float',
            def: null,
            name: 'y',
            label: 'Y'
          }
        ];
      }
      superAlterFields(schema);
    };
  },
  construct: function(self, options) {
    var superPushAssets = self.pushAssets;
    self.pushAssets = function() {
      superPushAssets();
      self.pushAsset('stylesheet', 'user', { when: 'user' });
      self.pushAsset('stylesheet', 'always', { when: 'always' });
    };
  },
  afterConstruct: function(self) {
    self.pushAssets();
  }
};
