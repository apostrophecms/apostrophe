apos.define('apostrophe-widgets', {

  afterConstruct: function(self, options) {

    // Define our editor subclass if it hasn't been
    // done explicitly. Also pass it options

    apos.define(self.editorName,
      {
        extendIfFirst: 'apostrophe-widget-editor',
        label: self.label,
        action: self.action,
        schema: self.schema
      }
    );

  },

  construct: function(self, options) {

    self.editorName = self.name + '-widget-editor';

    self.edit = function(data, options, save) {
      apos.create(self.editorName, {
        action: self.options.action,
        schema: self.options.schema,
        data: data,
        templateOptions: options,
        save: save,
        module: self
      });
    };
  }

});
