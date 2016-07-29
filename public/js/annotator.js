/* global apos, _ */

/* options.receive must be a function that accepts an array of
  the annotated file objects. Use the _id property to identify them.

  options.remove may optionally be a function that accepts a file
  object that has just been deleted by the user during annotation.

  options.destroyed should be a function to be called when the annotator
  destroys itself on close. This is a useful way to know it's necessary to open
  a new annotator for the next file. */

function AposAnnotator(options) {
  var self = this;
  if (!options) {
    options = {};
  }

  self.cancellable = true;

  // Direct children so we don't hoover up jquery selective's items too.
  // TODO: think about using a more obscure data attribute in jquery
  // selective so this is not a problem
  self.liveItem = '[data-items] > [data-item]:not(.apos-template)';

  // PUBLIC API

  // Call this method after constructing the object

  self.modal = function() {
    self.$el = apos.modalFromTemplate(options.template || '.apos-file-annotator', self);
  };

  self.addItem = function(item) {
    var $item = apos.fromTemplate(self.$el.find('[data-item].apos-template'));
    if (item.group === 'images') {
      var $img = $('<img class="apos-preview-image" />');
      $img.attr('src', apos.filePath(item, { size: 'one-third' }));
      $item.find('[data-preview]').html($img);
    }

    var required = apos.data.files.required || [];
    _.each(required, function(field) {
      var $field = $item.findByName(field);
      $field.addClass('apos-error');
      $field.closest('.apos-fieldset').find('label').append('<span class="apos-error-message"> * required</span>');
    });

    $item.data('id', item._id);
    $item.findByName('title').val(item.title || '');
    $item.findByName('description').val(item.description || '');
    $item.findByName('credit').val(item.credit || '');
    $item.findByName('private').val(item.credit || '0');
    apos.enableTags($item.find('[data-name="tags"]'), item.tags || []);

    $item.on('click', '[data-delete-item]', function() {
      if (confirm('Are you sure you want to cancel uploading this file?')) {
        self.deleteItem(item, $item);
      }
      return false;
    });

    self.$el.find('[data-items]').append($item);
    apos.emit('enhance', $item);

    try {
      self.debriefItem($item);
    } catch (e) {
      // If we can't debrief it yet, that means it has
      // missing required fields or other errors in its
      // current state, so don't let the user cancel,
      // force them to clean it up. Needed to make
      // required fields for media work (FM). -Tom
      self.cancellable = false;
    }
  };

  // MODAL CALLBACKS

  self.init = function(callback) {
    return callback(null);
  };

  self.save = function(callback) {
    var data;
    try {
      data = self.debrief();
    } catch (e) {
      return callback(e);
    }
    return $.jsonCall(options.annotateUrl || '/apos/annotate-files',
      data,
      function(results) {
        return options.receive(results, callback);
      },
      function() {
        // must always invoke save callback
        return callback(null);
      }
    );
  };

  self.deleteItem = function(item, $item) {
    $item.remove();
    return $.ajax({
      url: '/apos/delete-file',
      data: { _id: item._id, trash: 1 },
      type: 'POST',
      success: function() {
        if (options.remove) {
          options.remove(item);
        }
        if (!self.$el.find(self.liveItem).length) {
          // None left
          self.$el.trigger('aposModalHide');
        }
      },
      error: function() {
        alert('You do not have access or the item has been deleted.');
      }
    });
  }

  self.debrief = function() {
    var data = [];
    self.$el.find(self.liveItem).each(function() {
      var $item = $(this);
      data.push(self.debriefItem($item));
    });
    return data;
  };

  self.debriefItem = function($item) {
    var info = {
      _id: $item.data('id'),
      title: $item.findByName('title').val(),
      description: $item.findByName('description').val(),
      tags: $item.find('[data-name="tags"]').selective('get', { incomplete: true }),
      credit: $item.findByName('credit').val(),
      private: $item.findByName('private').val()
    };

    var required = apos.data.files.required || [];
    _.each(required, function(field) {
      var good;
      var $el;
      if (field === 'tags') {
        good = !!info[field].length;
        $el = $item.find('[data-name="tags"] input');
      } else {
        good = !!info[field];
        $el = $item.findByName(field);
      }
      if (!good) {
        $el.focus();
        var offset = $el.offset();
        var scrollTop = offset.top - 100;
        $('html, body').scrollTop(scrollTop);
        throw "required";
      }
    });
    return info;
  };

  // If we are unable to debrief the annotator because of an
  // incomplete response, refuse to cancel
  self.beforeCancel = function(callback) {
    if (self.cancellable) {
      return callback();
    }
    alert('Please complete all required fields and click Save Changes. If you want to cancel the upload of one of your files, click "Cancel Upload" for that file.');
    // If any required fields are currently missing scroll to them
    try {
      self.debrief();
    } catch (e) {
      return callback(e);
    }
    return callback('invalid');
  };

  self.afterHide = function(callback) {
    if (options.destroyed) {
      options.destroyed();
    }
    return callback(null);
  };
}
