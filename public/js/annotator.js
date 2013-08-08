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

  // PUBLIC API

  // Call this method after constructing the object
  self.modal = function() {
    self.$el = apos.modalFromTemplate(options.template || '.apos-file-annotator', self);
  };

  self.addItem = function(item) {
    var $item = apos.fromTemplate(self.$el.find('[data-item].apos-template'));
    if (item.group === 'images') {
      var $img = $('<img class="apos-preview-image" />');
      $img.attr('src', apos.filePath(item, { size: 'one-sixth' }));
      $item.find('[data-preview]').html($img);
    }
    $item.data('id', item._id);
    $item.findByName('title').val(item.title || '');
    $item.findByName('description').val(item.description || '');
    $item.findByName('credit').val(item.credit || '');
    apos.enableTags($item.find('[data-name="tags"]'), item.tags || []);
    self.$el.find('[data-items]').append($item);
  };

  // MODAL CALLBACKS

  self.init = function(callback) {
    return callback(null);
  };

  self.save = function(callback) {
    var data = [];
    // Direct children so we don't hoover up jquery selective's items too.
    // TODO: think about using a more obscure data attribute in jquery
    // selective so this is not a problem
    self.$el.find('[data-items] > [data-item]:not(.apos-template)').each(function() {
      var $item = $(this);
      data.push(self.debriefItem($item));
    });
    return $.jsonCall(options.annotateUrl || '/apos/annotate-files',
      data,
      function(results) {
        return options.receive(results, callback);
      }
    );
  };

  self.debriefItem = function($item) {
    return {
      _id: $item.data('id'),
      title: $item.findByName('title').val(),
      description: $item.findByName('description').val(),
      tags: $item.find('[data-name="tags"]').selective('get'),
      credit: $item.findByName('credit').val()
    };
  };

  self.afterHide = function() {
    if (options.destroyed) {
      options.destroyed();
    }
  };
}

