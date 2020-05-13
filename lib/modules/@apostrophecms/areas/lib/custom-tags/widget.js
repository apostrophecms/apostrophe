// Implements {% widget item, { options ...} %}
// Usually not called directly, see {% singleton %} and {% area %}

module.exports = function(self, options) {

  return {
    async run(req, item, options) {
      if (!item) {
        self.apos.utils.warn('a null widget was encountered.');
        return '';
      }
      if (!options) {
        options = {};
      }
      let manager = self.getWidgetManager(item.type);
      if (!manager) {
        // Not configured in this project
        self.warnMissingWidgetType(item.type);
        return '';
      }
      return manager.output(req, item, options);
    }
  };

};
