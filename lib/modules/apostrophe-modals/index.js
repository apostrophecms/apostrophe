// This module provides a base class for modal dialog boxes and supplies
// related markup and LESS files.

module.exports = {
  components: {},
  alias: 'modals',
  afterConstruct: function(self, options) {
    self.enableBrowserData();
  },
  construct: function(self, options) {
    self.modals = [];
    // Add a modal that appears when an `adminBarItem` event corresponding
    // to its `itemName` appears on the bus. The `options` are passed
    // as the `options` prop, and the component will be of the type
    // specified by `componentName`.
    self.add = function(itemName, componentName, options) {
      self.modals.push({
        itemName,
        componentName,
        options
      });
    };
    self.getBrowserData = function(req) {
      return {
        modals: self.modals,
        components: {
          the: options.components.the || 'TheApostropheModals'
        }
      };
    };
  }
};
