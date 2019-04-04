apos.define('apostrophe-widgets', {
  // Implicitly extends the definition in always.js

  construct: function(self, options) {

    self.options = options;
    self.editorName = self.name + '-widgets-editor';

    // Opens the editor modal of a widget, unless the widget is contextualOnly,
    // in which case we simply save the widget and call the save method
    // Widget can opitonally be set to skipInitialModal which skips the first
    // edit modal but binds future editing interactions

    self.edit = function(data, options, save) {
      if (!data) {
        data = {};
      }
      if (!data._id) {
        _.assign(data, apos.schemas.newInstance(self.schema));
      }

      // Only create a modal editor if the schema is not contextual only
      if (self.options.contextualOnly) {

        return save(checkOrGenerateId(data), function() {});

      } else {

        if (self.options.skipInitialModal && (!data || !data._id)) {
          return save(checkOrGenerateId(data), function() {});

        }

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

      // Checks for an id or assign a generated one
      function checkOrGenerateId (data) {
        data = data || {};
        if (!data._id) {
          data._id = apos.utils.generateId();
        }
        return data;
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
      // If the field is contextual and its type has a `contextualConvert`
      // function, we need to run that when retrieving the widget's data.
      // Or, if the field has a `contextualIsPresent` method, we can use that
      // to check whether an editor is actually present for it, bypassing the
      // need to restrict this feature solely to fields marked contextual
      // in the schema.
      _.each(self.schema, function(field) {
        var type = apos.schemas.fieldTypes[field.type];
        if (
          (type.contextualIsPresent && type.contextualIsPresent($widget, field) && type.contextualConvert) ||
          (field.contextual && type.contextualConvert)
        ) {
          apos.schemas.fieldTypes[field.type].contextualConvert(data, field.name, $widget, field);
        }
      });
      return data;
    };

    // Start autosaving the area containing the given widget,
    // then invoke the given function. On failure fn is not invoked.
    // Invoked by widgets that are edited contextually on the page,
    // like apostrophe-rich-text, as opposed to widgets edited
    // via a modal.

    self.startAutosavingAreaThen = function($widget, fn) {
      var $area = $widget.closest('[data-apos-area]');
      return $area.data('editor').startAutosavingThen(fn);
    };
  }

});
