// Implements {% widget item, { options ...} %}
// Usually not called directly, see {% singleton %} and {% area %}

module.exports = function(self, options) {

  return {
    async run(context, item, options) {
      const req = context.env.opts.req;
      if (!item) {
        self.apos.util.warn('a null widget was encountered.');
        return '';
      }
      if (!options) {
        options = {};
      }
      const manager = self.getWidgetManager(item.type);
      if (!manager) {
        // Not configured in this project
        self.warnMissingWidgetType(item.type);
        return '';
      }
      return manager.output(req, item, options);
    }
  };

};
