module.exports = {
  improve: '@apostrophecms/rich-text-widget',
  options: {
    anchors: false
  },
  extendMethods(self) {
    return {
      annotateWidgetForExternalFront(_super, widget) {
        return {
          ..._super(widget),
          anchorAttribute: self.options.anchorAttribute,
          anchors: self.options.anchors,
          anchorDefault: self.options.anchorDefault
        };
      }
    };
  }
};
