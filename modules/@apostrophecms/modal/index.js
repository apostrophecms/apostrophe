// This module provides a base class for modal dialog boxes and supplies
// related markup and LESS files.

module.exports = {
  options: {
    components: {},
    alias: 'modal'
  },
  init(self) {
    self.modals = [];
    self.enableBrowserData();
  },
  methods(self) {
    return {
      // Add a modal that appears when an `admin-menu-click` event corresponding
      // to its `itemName` appears on the bus. `props` is merged with the props,
      // and the component will be of the type specified by `componentName`.
      add(itemName, componentName, props) {
        self.modals.push({
          itemName,
          componentName,
          props
        });
      },
      getBrowserData(req) {
        return {
          modals: self.modals,
          components: {
            the: self.options.components.the || 'TheAposModals',
            confirm: self.options.components.confirm || 'AposModalConfirm'
          }
        };
      }
    };
  }
};
