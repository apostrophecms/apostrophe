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
          // Sanitize attribute name to a whitelist
          let attr = self.options.anchorAttribute || 'id';
          if (![ 'id', 'name', 'data-anchor' ].includes(attr)) {
            attr = 'id';
          }

          // Escape the anchorId to prevent XSS
          const escapedId = self.apos.util.escapeHtml(widget.anchorId);
          const opener = `<div ${attr}="${escapedId}">`;

          return opener + rendered + '</div>';
        } else {
          return rendered;
        }
      },
      annotateWidgetForExternalFront(_super, widget, { scene } = {}) {
        return {
          ..._super(widget, { scene }),
          anchorAttribute: self.options.anchorAttribute,
          anchors: self.options.anchors,
          anchorDefault: self.options.anchorDefault
        };
      }
    };
  }
};