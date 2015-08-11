apos.define('apostrophe-attachments', {
  extend: 'apostrophe-context',
  afterConstruct: function(self) {
    self.addFieldType();
    self.addHandlers();
  },
  construct: function(self, options) {
    self.addFieldType = function() {
      apos.schemas.addFieldType({
        populate: self.populate,
        convert: self.convert
      });
    };
    self.populate = function(object, name, $field, $el, field, callback) {
      var $fieldset = apos.schemas.findFieldset($el, name);
      self.updateExisting($fieldset, object[name]);

      // A bulk upload button is provided separately at the array level
      // if multipleUpload: true is set on an array schema field. -Tom

      var $uploader = $fieldset.find('[data-uploader]');

      $uploader.fileupload({
        dataType: 'json',
        dropZone: $fieldset,
        maxNumberOfFiles: 1,
        url: self.action + '/upload',
        start: function (e) {
          busy(true);
        },
        // Even on an error we should note we're not spinning anymore
        always: function (e, data) {
          busy(false);
        },
        done: function (e, data) {
          if (data.result.status !== 'ok') {
            alert(data.result.status);
            return;
          }
          var file = data.result.file;
          self.updateExisting($fieldset, file);
        },
        add: function(e, data) {
          return data.submit();
        }
      });

      function busy(state) {
        $fieldset.attr('data-busy', state);
        apos.ui.busy($uploader, state);
      }

    };

    self.convert = function(data, name, $field, $el, field, callback) {
      if ($fieldset.attr('data-busy')) {
        // If upload is in progress stay busy until this upload
        // completes. Other file attachment fields may be doing
        // the same dance.
        setTimeout(function() {
          self.convert(data, name, $field, $el, field, callback);
        }, 100);
        return;
      }
      var $fieldset = apos.schemas.findFieldset($el, name);
      data[name] = $fieldset.find('[data-existing]').attr('data-existing');
      if (field.required && (!data[name])) {
        return setImmediate(_.partial(callback, required));
      }
      return setImmediate(callback);
    };

    self.addHandlers = function() {
      apos.ui.link('trash', 'attachment', function($el, id) {
        self.api('trash', { id: id }, function(result) {
          if (result.status !== 'ok') {
            return;
          }
          var $existing = $el.closest('[data-existing]');
          $existing.hide();
        });
        return false;
      });
    };

    self.updateExisting = function($fieldset, file) {
      var $existing = $fieldset.find('[data-existing]');
      if (!file) {
        $existing.attr('data-existing', '');
        $existing.hide();
        return;
      }
      $existing.attr('data-existing', file.id);
      $existing.find('[data-name]').text(file.name);
      $existing.alterClass('apos-extension-*', 'apos-extension-' + file.extension);
      var $preview = $existing.find('[data-preview]');
      if (file.group === 'images') {
        $preview.css('background-image', self.url(file, { size: 'one-sixth' }));
      } else {
        $preview.hide();
      }
      $existing.show();
    };
  }
});
