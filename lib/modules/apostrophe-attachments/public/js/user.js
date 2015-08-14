apos.define('apostrophe-attachments', {
  extend: 'apostrophe-context',
  afterConstruct: function(self) {
    self.addFieldType();
    self.addHandlers();
  },
  construct: function(self, options) {
    self.name = options.name;
    self.action = options.action;
    self.uploadsUrl = options.uploadsUrl || '';


    self.addFieldType = function() {
      apos.schemas.addFieldType({
        name: self.name,
        displayer: self.displayer,
        converter: self.converter
      });
    };

    self.displayer = function(object, name, $field, $el, field, callback) {
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
          apos.log(data);
          self.updateExisting($fieldset, file);
        },
        add: function(e, data) {
          return data.submit();
        }
      });

      return setImmediate(callback);

      function busy(state) {
        $fieldset.attr('data-busy', state ? '1' : '0');
        apos.ui.busy($uploader, state);
      }

    };

    self.converter = function(data, name, $field, $el, field, callback) {
      var $fieldset = apos.schemas.findFieldset($el, name);
      if ($fieldset.attr('data-busy') === '1') {
        apos.log('reiterating');
        // If upload is in progress stay busy until this upload
        // completes. Other file attachment fields may be doing
        // the same dance.
        setTimeout(function() {
          self.converter(data, name, $field, $el, field, callback);
        }, 100);
        return;
      }
      var $fieldset = apos.schemas.findFieldset($el, name);
      data[name] = $fieldset.find('[data-existing]').attr('data-existing');
      if (field.required && (!data[name])) {
        apos.log('requiring');
        return setImmediate(_.partial(callback, 'required'));
      }
      apos.log('happy');
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
      apos.log('setting ID to: ');
      apos.log(file.id);
      $existing.attr('data-existing', file.id);
      $existing.find('[data-name]').text(file.name);
      $existing.alterClass('apos-extension-*', 'apos-extension-' + file.extension);
      var $preview = $existing.find('[data-preview]');
      if (file.group === 'images') {
        console.log(self.url(file, { size: 'one-sixth' }));
        $preview.css('background-image', 'url(' + self.url(file, { size: 'one-sixth' }) + ')');
      } else {
        $preview.hide();
      }
      $existing.show();
    };

    // Given a file object (as found in a slideshow widget for instance),
    // return the file URL. If options.size is set, return the URL for
    // that size (one-third, one-half, two-thirds, full). full is
    // "full width" (1140px), not the original.
    //
    // If you don't pass the options object, or options does not
    // have a size property, you'll get the URL of the original.

    self.url = function(file, options) {
      var path = self.uploadsUrl + '/attachments/' + file.id + '-' + file.name;
      if (!options) {
        options = {};
      }
      // NOTE: the crop must actually exist already, you can't just invent them
      // browser-side without the crop API never having come into play
      if (file.crop) {
        var c = file.crop;
        path += '.' + c.left + '.' + c.top + '.' + c.width + '.' + c.height;
      }
      if (options.size) {
        path += '.' + options.size;
      }
      return path + '.' + file.extension;
    };
  }
});
