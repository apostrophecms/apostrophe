module.exports = {
  improve: '@apostrophecms/widget-type',
  fields (self, options) {
    if (options.anchors === false) {
      return {};
    }

    return {
      add: {
        anchorId: {
          type: 'slug',
          label: 'aposAnchors:anchorId',
          help: 'aposAnchors:anchorIdHelp',
          following: options.anchorDefault,
          last: true // TODO: Confirm we're merging this feature.
        }
      }
    };
  },
  extendMethods(self) {
    return {
      async output(_super, req, widget, options, _with) {
        const rendered = await _super(req, widget, options, _with);

        if (widget.anchorId && self.options.anchors !== false) {
          // Apply a wrapper div with the anchor attribute.
          const attr = self.options.anchorAttribute || 'id';
          const opener = `<div ${attr}=${widget.anchorId}>`;

          return opener + rendered + '</div>';
        } else {
          return rendered;
        }
      },
      annotateWidgetForExternalFront(_super) {
        return {
          ..._super,
          anchorAttribute: self.options.anchorAttribute,
          anchors: self.options.anchors,
          anchorDefault: self.options.anchorDefault
        };
      }
    };
  }
};
