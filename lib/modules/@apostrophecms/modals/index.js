// This module provides a base class for modal dialog boxes and supplies
// related markup and LESS files.

module.exports = {
  options: {
    components: {},
    alias: 'modals'
  },
  init(self, options) {
    self.modals = [];
    self.enableBrowserData();
  },
  methods(self, options) {
    return {
      // Add a modal that appears when an `adminBarItem` event corresponding
      // to its `itemName` appears on the bus. The `options` are passed
      // as the `options` prop, and the component will be of the type
      // specified by `componentName`.
      add(itemName, componentName, options) {
        self.modals.push({
          itemName,
          componentName,
          options
        });
      },
      getBrowserData(req) {
        return {
          modals: self.modals,
          components: { the: options.components.the || 'TheAposModals' }
        };
      }
    };
  }
};
