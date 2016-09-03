apos.define('apostrophe-widgets', {
  // Implicitly extends the definition in always.js

  construct: function(self, options) {

    self.options = options;
    self.editorName = self.name + '-widgets-editor';

    // Opens the editor modal of a widget, unless the widget is contextualOnly,
    // in which case we simply save the widget and call the save method
    self.edit = function(data, options, save) {
      // Only create a modal editor if the schema is not contextual only
      if(self.options.contextualOnly){
        // Check for an id or assign a generated one
        data = data || {};
        if (!data._id) {
          data._id = apos.utils.generateId();
        }
        // Save the new widget
        return save(data, function() {});
      } else {
        apos.create(self.editorName, {
          label: self.label,
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

    var superGetData = self.getData;
    self.getData = function($widget) {
      var data = superGetData($widget);
      // If the field is contextual and its type has a contextualConvert
      // function, we need to run that when retrieving the widgets data
      _.each(self.schema, function(field) {
        if (field.contextual && apos.schemas.fieldTypes[field.type].contextualConvert) {
          apos.schemas.fieldTypes[field.type].contextualConvert(data, field.name, $widget, field);
        }
      });
      return data;
    };
  }

});
