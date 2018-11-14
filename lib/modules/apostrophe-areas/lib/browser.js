const _ = require('lodash');

module.exports = function(self, options) {
  self.getBrowserData = function(req) {
    const widgets = {};
    const widgetEditors = {};
    const widgetManagers = {};
    _.each(self.widgetManagers, function(manager, name) {
      widgets[name] = (manager.options.browser && manager.options.browser.components && manager.options.browser.components.widget) || 'ApostropheWidget';
      widgetEditors[name] = (manager.options.browser && manager.options.browser.components && manager.options.browser.components.widgetEditor) || 'ApostropheWidgetEditor';
      widgetManagers[name] = manager.__meta.name;
    });
    return {
      components: {
        editor: 'ApostropheAreaEditor' || (options.browser && options.browser.components && options.browser.components.editor),
        widgets: widgets,
        widgetEditors: widgetEditors
      },
      widgetManagers: widgetManagers,
      action: self.action
    };
  };
};
