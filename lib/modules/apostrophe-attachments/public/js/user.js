apos.define('apostrophe-attachments', {

  afterConstruct: function(self) {
    self.addFieldType();
    self.addHandlers();
  },

  construct: function(self, options) {
    self.name = options.name;
    self.action = options.action;

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

      // If there is an existing crop of the attachment itself (not just a relationship),
      // omit that from the attachment object for purposes of cropping again, and move it to the options

      if (args.attachment.crop) {
        if (!args.crop) {
          args.crop = args.attachment.crop;
        }
        delete args.attachment.crop;
      }
      _.assign(args, options);
      apos.create('apostrophe-attachments-crop-editor', args);
    };

    // Invoke with an attachment, options (such as minSize), and a callback.
    // Callback receives (err, focalPoint). If no err, focalPoint has x and y
    // properties and can be stored as the focalPoint property of the attachment
    // (when there is one and only one focal point ever for this attachment), or
    // stored as part of a relationship to the doc containing the attachment; that part
    // is up to you.

    self.focalPoint = function(attachment, options, callback) {

      var args = {
        action: self.action,
        attachment: attachment,
        setFocalPoint: function(focalPoint) {
          return callback(null, focalPoint);
        }
      };

      // If there is an existing focal point for the attachment itself (not just a relationship),
      // omit that from the attachment object for purposes of editing again, and move it to the options

      if (args.attachment.focalPoint) {
        if (!args.focalPoint) {
          args.focalPoint = args.attachment.focalPoint;
        }
        delete args.attachment.focalPoint;
      }
      _.assign(args, options);
      apos.create('apostrophe-attachments-focal-point-editor', args);
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
      self.updateExisting($fieldset, object[name], field);

      var $trashButton = $fieldset.find('[data-apos-trash]');

      // A bulk upload button is provided separately at the array level
      // if multipleUpload: true is set on an array schema field. -Tom

      var $uploaderButton = $fieldset.find('[data-apos-uploader-target]');
      var $input = $fieldset.find('input[type="file"]');

      // configure button to fire input click
      $uploaderButton.on('click', function() {
        // input element gets replaced after each use, so we have to
        // find it each time we want to click it programmatically. -Tom
        $fieldset.find('input[type="file"]').click();
      });

      $trashButton.on('click', function() {
        self.updateExisting($fieldset, null, field);
        return false;
      });

      $input.fileupload({
        dataType: 'json',
        dropZone: $fieldset,
        maxNumberOfFiles: 1,
        url: self.action + '/upload',
        start: function (e) {
          busy(true);
          apos.emit('attachmentUploadStarted', {
            $fieldset: $fieldset,
            field: field
          });
        },
        // Even on an error we should note we're not spinning anymore
        always: function (e, data) {
          busy(false);
        },
        done: function (e, data) {
          var extensions;
          if (data.result.status !== 'ok') {
            apos.notify(data.result.status, { type: 'error' });
            apos.emit('attachmentUploadError', {
              $fieldset: $fieldset,
              field: field,
              status: data.result.status
            });
            return;
          }
          var file = data.result.file;
          var groups = field.fileGroups || (field.fileGroup && [ field.fileGroup ]);
          if (groups) {
            if (!_.contains(groups, file.group)) {
              extensions = [];
              _.each(groups, function(group) {
                var groupInfo = _.find(self.options.fileGroups, { name: group });
                if (!groupInfo) {
                  return;
                }
                extensions = extensions.concat(groupInfo.extensions);
              });
              apos.notify("The file must be of one of the following types: %s", extensions.join(', '), { type: 'error' });
              return;
            }
          }
          extensions = field.extensions || (field.extension && [ field.extension ]);
          if (extensions) {
            if (!_.contains(extensions, file.extension)) {
              apos.notify("The file must be of one of the following types: %s", extensions.join(', '), { type: 'error' });
              return;
            }
          }
          apos.emit('attachmentUploadSuccess', {
            $fieldset: $fieldset,
            field: field
          });
          self.updateExisting($fieldset, file, field);
        },
        add: function(e, data) {
          return data.submit();
        }
      });

      return setImmediate(callback);

      function busy(state) {
        $uploaderButton.attr('data-busy', state ? '1' : '0');
        apos.ui.busy($fieldset, !!state);
      }

    };

    self.convert = function(data, name, $field, $el, field, callback) {
      var $fieldset = apos.schemas.findFieldset($el, name);
      var $uploaderButton = $fieldset.find('[data-apos-uploader-target]');
      if ($uploaderButton.attr('data-busy') === '1') {
        // If upload is in progress stay busy until this upload
        // completes. Other file attachment fields may be doing
        // the same dance.
        setTimeout(function() {
          self.convert(data, name, $field, $el, field, callback);
        }, 100);
        return;
      }
      data[name] = $fieldset.find('[data-existing]').data('existing');
      if (data[name] && (!data[name].crop) && field.aspectRatio) {
        return self.autocrop(field, data[name], function(err) {
          if (err) {
            return callback(err);
          }
          return finish();
        });
      } else {
        return finish();
      }
      function finish() {
        if (field.required && (!data[name])) {
          return setImmediate(_.partial(callback, 'required'));
        }
        return setImmediate(callback);
      }
    };

    self.autocrop = function(field, attachment, callback) {
      var aspectRatio = field.aspectRatio;
      if (!aspectRatio) {
        return callback(null);
      }
      aspectRatio = aspectRatio[0] / aspectRatio[1];
      var width = attachment.width;
      var height = attachment.width / aspectRatio;
      var left = 0;
      var top = (attachment.height - height) / 2;
      if (height > attachment.height) {
        width = attachment.height * aspectRatio;
        height = attachment.height;
        left = (attachment.width - width) / 2;
        top = 0;
      }
      return apos.attachments.api(
        'crop',
        {
          _id: attachment._id,
          crop: { top: top, left: left, width: width, height: height }
        },
        function(data) {
          if (data.status !== 'ok') {
            apos.notify('An error occurred while cropping.', { type: 'error', dismiss: true });
            return callback('fail');
          }
          attachment.crop = {
            top: top,
            left: left,
            width: width,
            height: height
          };
          return callback(null);
        }
      );
    };

    self.addHandlers = function() {
      apos.ui.link('apos-crop', 'attachment', function($el, _id) {
        var $existing = $el.closest('[data-existing]');

        var attachment = $existing.data('existing');
        var field = $existing.data('field');
        var $fieldset = $el.closest('[data-name]');
        var options = {};
        options.focalPoint = field.focalPoint || (field.hints && field.hints.focalPoint);
        options.minSize = field.minSize || (field.hints && field.hints.minSize);
        options.aspectRatio = field.aspectRatio || (field.hints && field.hints.aspectRatio);
        self.crop(attachment, options, function(err, crop) {
          if (!err) {
            attachment.crop = crop;
            self.updateExisting($fieldset, attachment, field);
          }
        });
      });

      apos.ui.link('apos-focal-point', 'attachment', function($el, _id) {
        var $existing = $el.closest('[data-existing]');

        var attachment = $existing.data('existing');
        var field = $existing.data('field');
        var $fieldset = $el.closest('[data-name]');
        var options = {};
        options.focalPoint = field.focalPoint || (field.hints && field.hints.focalPoint);
        self.focalPoint(attachment, options, function(err, focalPoint) {
          if (!err) {
            attachment.focalPoint = focalPoint;
            self.updateExisting($fieldset, attachment, field);
          }
        });
      });
    };

    self.updateExisting = function($fieldset, info, field) {
      var $existing = $fieldset.find('[data-existing]');
      if (!info) {
        $existing.data('existing', null);
        $existing.hide();
        return;
      }
      $existing.data('existing', info);
      $existing.data('field', field);
      $existing.attr('data-existing', info._id);
      $existing.find('[data-name]').text(info.name);
      $existing.find('[data-link]').attr('href', self.url(info));
      $existing.alterClass('apos-extension-*', 'apos-extension-' + info.extension);
      var $preview = $existing.find('[data-preview]');
      if (info.group === 'images') {
        $preview.attr('src', self.url(info, { size: 'one-half', crop: info.crop }));
        $fieldset.find('[data-apos-crop-attachment]').show();
        $fieldset.find('[data-apos-focal-point-attachment]').show();
      } else {
        $preview.hide();
        $fieldset.find('[data-apos-crop-attachment]').hide();
        $fieldset.find('[data-apos-focal-point-attachment]').hide();
      }
      $existing.show();
      apos.emit('attachmentUpdated', {
        $fieldset: $fieldset,
        attachment: info,
        field: field
      });
    };

    apos.attachments = self;

  }
});
