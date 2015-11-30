apos.define('apostrophe-attachments', {

  afterConstruct: function(self) {
    self.addFieldType();
    self.addHandlers();
  },

  construct: function(self, options) {
    self.name = options.name;
    self.action = options.action;
    self.uploadsUrl = options.uploadsUrl || '';

    // Invoke with an attachment, options (such as minSize), and a callback.
    // Callback receives (err, crop). If no err, crop has coordinates and
    // can be stored as the crop property of the attachment (when there is
    // one and only one crop ever for this attachment), or stored as part
    // of a relationship to the doc containing the attachment; that part
    // is up to you.

    self.crop = function(attachment, options, callback) {
      var args = {
        action: self.action,
        attachment: attachment,
        cropped: function(crop) {
          return callback(null, crop);
        }
      };
      _.assign(args, options);
      apos.create('apostrophe-attachments-crop-editor', args);
    };

    self.addFieldType = function() {
      apos.schemas.addFieldType({
        name: self.name,
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

      return setImmediate(callback);

      function busy(state) {
        $fieldset.attr('data-busy', state ? '1' : '0');
        apos.ui.busy($uploader, state);
      }

    };

    self.convert = function(data, name, $field, $el, field, callback) {
      var $fieldset = apos.schemas.findFieldset($el, name);
      if ($fieldset.attr('data-busy') === '1') {
        // If upload is in progress stay busy until this upload
        // completes. Other file attachment fields may be doing
        // the same dance.
        setTimeout(function() {
          self.converter(data, name, $field, $el, field, callback);
        }, 100);
        return;
      }
      var $fieldset = apos.schemas.findFieldset($el, name);
      data[name] = $fieldset.find('[data-existing]').data('existing');
      if (field.required && (!data[name])) {
        return setImmediate(_.partial(callback, 'required'));
      }
      return setImmediate(callback);
    };

    self.addHandlers = function() {
      apos.ui.link('trash', 'attachment', function($el, _id) {
        self.api('trash', { _id: _id }, function(result) {
          if (result.status !== 'ok') {
            return;
          }
          var $existing = $el.closest('[data-existing]');
          $existing.hide();
        });
        return false;
      });
      apos.ui.link('crop', 'attachment', function($el, _id) {
        var attachment = $el.closest('[data-existing]').data('existing');
        var $fieldset = $el.closest('fieldset');
        // TODO what about minSize, etc. in this context?
        self.crop(attachment, {}, function(err, crop) {
          if (!err) {
            attachment.crop = crop;
            self.updateExisting($fieldset, attachment);
          }
        });
      });
    };

    self.updateExisting = function($fieldset, info) {
      var $existing = $fieldset.find('[data-existing]');
      if (!info) {
        $existing.data('existing', null);
        $existing.hide();
        return;
      }
      $existing.data('existing', info);
      $existing.attr('data-existing', info._id);
      $existing.find('[data-name]').text(info.name);
      $existing.alterClass('apos-extension-*', 'apos-extension-' + info.extension);
      var $preview = $existing.find('[data-preview]');
      if (info.group === 'images') {
        $preview.css('background-image', 'url(' + self.url(info, { size: 'one-sixth', crop: info.crop }) + ')');
        $fieldset.find('[data-crop-attachment]').show();
      } else {
        $preview.hide();
        $fieldset.find('[data-crop-attachment]').hide();
      }
      $existing.show();
    };

    apos.attachments = self;

  }
});
