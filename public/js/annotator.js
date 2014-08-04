/* global apos, _ */

/* options.receive must be a function that accepts an array of
  the annotated file objects. Use the _id property to identify them.

  options.destroyed should be a function to be called when the annotator
  destroys itself on close. This is a useful way to know it's necessary to open
  a new annotator for the next file. */

function AposAnnotator(options) {
  var self = this;
  if (!options) {
    options = {};
  }

  self.cancellable = true;

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
    $item.data('id', item._id);
    $item.findByName('title').val(item.title || '');
    $item.findByName('description').val(item.description || '');
    $item.findByName('credit').val(item.credit || '');
    apos.enableTags($item.find('[data-name="tags"]'), item.tags || []);
    self.$el.find('[data-items]').append($item);
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
      }
    );
  };

  self.debrief = function() {
    var data = [];
    // Direct children so we don't hoover up jquery selective's items too.
    // TODO: think about using a more obscure data attribute in jquery
    // selective so this is not a problem
    self.$el.find('[data-items] > [data-item]:not(.apos-template)').each(function() {
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
      credit: $item.findByName('credit').val()
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
    alert('Please complete all required fields and click Save Changes.');
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

