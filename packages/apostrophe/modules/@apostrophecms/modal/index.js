// This module provides a base class for modal dialog boxes and supplies
// related markup and LESS files, and the window triggers.

const TRIGGER_CORNERS = [ 'top-left', 'top-right', 'bottom-left', 'bottom-right' ];

module.exports = {
  options: {
    components: {},
    alias: 'modal'
  },
  init(self) {
    self.modals = [];
    self.triggers = [];
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
      // Add a window trigger: a button kept in a screen corner, above every
      // modal, that opens the modal `componentName` with `props`, usually a
      // window with `stacking: 'top'`. It starts in `corner` (`top-left`,
      // `top-right`, `bottom-left` or `bottom-right`, the default); the
      // editor drags it to another, remembered per device. It hides while
      // its window is open and rests low while any other modal is. `label`
      // names it for assistive technology (an i18n key), `icon` is a
      // registered icon name.
      addTrigger(name, {
        componentName, props = {}, label, icon, corner = 'bottom-right'
      }) {
        if (self.triggers.some(trigger => trigger.name === name)) {
          throw new Error(`The window trigger "${name}" is already added.`);
        }
        if (!TRIGGER_CORNERS.includes(corner)) {
          throw new Error(
            `The window trigger "${name}" has an unknown corner "${corner}", ` +
            `use one of: ${TRIGGER_CORNERS.join(', ')}.`
          );
        }
        self.triggers.push({
          name,
          componentName,
          props,
          label,
          icon,
          corner
        });
      },
      getBrowserData(req) {
        return {
          modals: self.modals,
          triggers: self.triggers,
          components: {
            the: self.options.components.the || 'TheAposModals',
            confirm: self.options.components.confirm || 'AposModalConfirm',
            report: self.options.components.report || 'AposModalReport'
          }
        };
      }
    };
  }
};
