apos.define('apostrophe-widgets', {

  afterConstruct: function(self) {

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

    self.options = options;

    self.editorName = self.name + '-widget-editor';

    self.edit = function(data, options, save) {
      //Only create a modal editor if the schema is not contextual only - Sam & Tom
      if(self.options.contextualOnly){
        //check for id or create one
        data = data || {};
        if (!data._id) {
          data._id = apos.utils.generateId();
        }
        //invoke save on the object
        return save(data, function(){});
      } else {
        apos.create(self.editorName, {
          action: self.options.action,
          schema: self.options.schema,
          data: data,
          templateOptions: options,
          save: save,
          module: self
        });
      }
    };

    // Area editor calls this to determine whether to apply an empty state
    // class for the widget
    self.isEmpty = function($widget) {
      return false;
    };
  }

});
