/* global apos, _, confirm */

function AposMediaLibrary(options) {
  var self = this;
  if (!options) {
    options = {};
  }

  // PUBLIC API

  // Call this method after constructing the object
  self.modal = function() {
    self.$el = apos.modalFromTemplate(options.template || '.apos-media-library', self);
    self.$index = self.$el.find('[data-index]');
    self.$show = self.$el.find('[data-show]');
    self.$normal = self.$show.find('[data-normal-view]');
    self.$bar = self.$el.find('[data-bar]');
    self.enableUploads();
    self.$index.bottomless({
      url: options.browseUrl || '/apos/browse-files',
      now: true,
      perPage: 20,
      skipAndLimit: true,
      criteria: self.getCriteria(),
      dataType: 'json',
      success: self.addResults,
      reset: self.resetCallback
    });

    // Make sure we can indirectly click on an upload button that's been visually replaced with
    // another element. Otherwise only dragging is permissible and in IE nothing is permissible
    self.$el.on('click', '.apos-file-styled', function() {
      $(this).parent().children('input').click();
      return false;
    });

    self.$el.on('click', '[data-index] [data-item]', function() {
      $.each($('[data-index] [data-item]'), function() {
        var $item = $(this);
        $item.removeClass('active');
      });
      $(this).addClass('active');
      self.showItem($(this).data('item'));
      return false;
    });

    self.$el.on('click', '[data-grid]', function() {
      self.$el.find('[data-index]').removeClass('apos-list-view').addClass('apos-grid-view');
      self.$el.find('.apos-generic-button').removeClass('active');
      $(this).addClass('active');
      return false;
    });
    self.$el.on('click', '[data-list]', function() {
      self.$el.find('[data-index]').removeClass('apos-grid-view').addClass('apos-list-view');
      self.$el.find('.apos-generic-button').removeClass('active');
      $(this).addClass('active');
      return false;
    });

    self.$el.on('click', '[data-show] [data-edit]', function() {
      self.editItem(self.$el.find('[data-show]').data('item'));
      return false;
    });
    self.$el.on('click', '[data-show] [data-rescue]', function() {
      self.rescueItem(self.$el.find('[data-show]').data('item'));
      return false;
    });
    self.$el.on('click', '[data-show] [data-edit-view] [data-cancel-item]', function() {
      self.$edit.remove();
      self.$normal.show();
      return false;
    });
    self.$el.on('click', '[data-show] [data-edit-view] [data-save-item]', function() {
      self.saveItem(function() {
        self.$edit.remove();
        self.$normal.show();
      });
      return false;
    });
    self.$el.on('click', '[data-show] [data-edit-view] [data-delete-item]', function() {
      self.deleteItem(function() {
        self.$edit.remove();
        self.$normal.show();
      });
      return false;
    });

    // Filters
    self.$el.on('change', '[name="owner"],[name="trash"],[name="sort"],[name="group"]', function() {
      self.resetIndex();
      return false;
    });
    self.$search = self.$el.find('[name="search"]');
    self.$search.bind('textchange', function() {
      self.resetIndex();
    });

    // Buttons in the show view that make sense only after an item is chosen
    self.$show.find('[data-edit]').hide();
    self.$show.find('[data-rescue]').hide();
  };

  self.enableUploads = function() {
    var $uploader = self.$el.find('[data-uploader]');
    $uploader.fileupload({
      dataType: 'json',
      dropZone: self.$el.find('.apos-index-pane'),
      // Best to keep it this way to avoid slamming when multiple users are active
      sequentialUploads: true,
      start: function (e) {
        busy(true);
      },
      // Even on an error we should note we're not spinning anymore
      always: function (e, data) {
        busy(false);
      },
      done: function (e, data) {
        if (data.result.files) {
          _.each(data.result.files, function (file) {
            self.annotateItem(file);
          });
          // Simplest way to show the new files
          self.resetIndex();
          apos.change('media');
        }
      },
      add: function(e, data) {
        return data.submit();
      }
    });
    function busy(state) {
      apos.busy(self.$el.find('.apos-add-files'), state);
    }

    // setup drag-over states
    self.$el.find('.apos-modal-body').bind('dragover', function (e) {
      var dropZone = self.$el.find('.apos-file-container'),
          timeout = window.dropZoneTimeout;
      if (!timeout) {
          dropZone.addClass('apos-media-file-in');
      } else {
          clearTimeout(timeout);
      }
      if (e.target === dropZone[0]) {
          dropZone.addClass('apos-media-file-hover');
      } else {
          dropZone.removeClass('apos-media-file-hover');
      }
      window.dropZoneTimeout = setTimeout(function () {
          window.dropZoneTimeout = null;
          dropZone.removeClass('apos-media-file-in apos-media-file-hover');
      }, 100);
    });
  };

  self.annotateItem = function(item) {
    if (!self.annotator) {
      var Annotator = options.Annotator || window.AposAnnotator;
      self.annotator = new Annotator({
        receive: function(aItems, callback) {
          // Modified the files, so reset the list view
          self.resetIndex();
          apos.change('media');
          return callback(null);
        },
        destroyed: function() {
          // End of life cycle for previous annotator, note that so
          // we can open another one
          self.annotator = undefined;
        }
      });
      self.annotator.modal();
    }
    self.annotator.addItem(item);
  };

  self.addResults = function(results) {
    _.each(results.files, function(item) {
      self.addIndexItem(item);
    });
    if (!results.length) {
      self.$el.trigger('aposScrollEnded');
    }
  };

  self.addIndexItem = function(item) {
    var $item = apos.fromTemplate(self.$index.find('[data-item].apos-template'));
    self.populateItem($item, item);
    self.$index.append($item);
  };

  self.populateItem = function($item, item) {
    $item.data('item', item);
    if (item.group === 'images') {
      var $img = $('<div class="apos-preview-image" style="background-image:url('+apos.filePath(item, { size: 'one-third' })+');" ></div>');
      // $img.attr('src', apos.filePath(item, { size: 'one-third' }));
      $item.find('[data-preview]').html($img);
    } else {
      $item.find('[data-preview]').html('<span class="apos-file-format apos-'+item.extension+'"></span>');
      $item.addClass('apos-file');
    }
    $item.find('[data-title]').text(item.title || item.name);
    $item.find('[data-list-details]').append('<span>Group: ' + item.group || + '</span>');
    $item.find('[data-list-details]').append('<span>Extension: ' + item.extension || + '</span>');
    $item.find('[data-list-details]').append('<span>Tags: ' + (item.tags || []).join(', ') + '</span>');
  };

  self.allShow = [ 'title', 'name', 'tags', 'credit', 'description', 'group', 'type', 'credit', 'extension', 'downloadOriginal' ];
  self.simpleShow = [ 'title', 'name', 'description', 'group', 'type', 'credit', 'extension' ];
  // self.listShow = [ 'title', 'name', 'group', 'type'];

  self.simpleEditable = [ 'title', 'credit', 'description' ];

  self.showItem = function(item) {
    self.$show.data('item', item);
    if (self.$edit) {
      self.$edit.remove();
    }
    self.moveToScrollTop(self.$normal);
    self.$normal.show();

    if (item.group === 'images') {
      var $img = $('<img class="apos-preview-image" />');
      $img.attr('src', apos.filePath(item, { size: 'one-half' }));
      self.$normal.find('[data-preview]').html($img);
    } else {
      self.$normal.find('[data-preview]').html('');
    }
    _.each(self.simpleShow, function(field) {
      if (item[field]){
        self.$normal.find('[data-name="' + field + '"]').text(item[field]);
      } else{
        self.$normal.find('[data-name="' + field + '"]').html("&mdash;");
      }
    });
    self.$normal.find('[data-name="tags"]').text((item.tags || []).join(', '));

    var $link = $('<a></a>');
    $link.attr('href', apos.filePath(item));
    $link.text(apos.filePath(item));
    var $downloadOriginal = self.$normal.find('[data-name="downloadOriginal"]');
    $downloadOriginal.html('');
    $downloadOriginal.append($link);

    // Show the edit button or the rescue button
    if (item.trash) {
      self.$show.find('[data-rescue]').show();
      self.$show.find('[data-edit]').hide();
    } else {
      self.$show.find('[data-rescue]').hide();
      self.$show.find('[data-edit]').show();
    }
  };

  self.editItem = function(item) {
    self.$show.data('item', item);
    self.$edit = apos.fromTemplate(self.$show.find('[data-edit-view]'));
    self.$edit.show();

    if (item.group === 'images') {
      var $img = $('<img class="apos-preview-image" />');
      $img.attr('src', apos.filePath(item, { size: 'one-sixth' }));
      self.$edit.find('[data-preview]').html($img);
    } else {
      self.$edit.find('[data-preview]').html('');
    }
    _.each(self.simpleEditable, function(field) {
      self.$edit.findByName(field).val(item[field]);
    });

    var url = options.replaceFileUrl || '/apos/replace-file';
    url += '?id=' + item._id;
    var $upload = self.$edit.find('[data-upload]');
    $upload.attr('data-url', url);
    $upload.fileupload({
      dataType: 'json',
      dropZone: self.$edit,
      sequentialUploads: true,
      add: function(e, data) {
        // TODO think about a way to undo even this
        if (!confirm('Are you sure you want to replace this file? This cannot be undone!')) {
          return false;
        }
        return data.submit();
      },
      start: function (e) {
        busy(true);
      },
      // Even on an error we should note we're not spinning anymore
      always: function (e, data) {
        busy(false);
      },
      // This is not the same thing as really being ready to work with the files,
      // so wait for 'done'
      // stop: function (e) {
      // },
      // Progress percentages are just misleading due to image rendering time,
      // so just show a spinner
      // progressall: function (e, data) {
      //   var progress = parseInt(data.loaded / data.total * 100, 10);
      //   self.$el.find('[data-progress-percentage]').text(progress);
      // },
      done: function (e, data) {
        if (data.result.status === 'ok') {
          // Refresh our knowledge of this file
          self.updateItem(data.result.file);
          // Make sure both views are updated. This could flash a
          // little but it's sure to be correct
          self.showItem(data.result.file);
          self.editItem(data.result.file);
          apos.change('media');
        }
      },
    });

    function busy(state) {
      apos.busy(self.$el.find('.apos-replace-file'), state);
    }

    apos.enableTags(self.$edit.find('[data-name="tags"]'), item.tags);
    self.$normal.hide();
    self.$show.append(self.$edit);
    self.moveToScrollTop(self.$edit);
  };

  self.saveItem = function(callback) {
    var item = self.$show.data('item');
    $.jsonCall(options.annotateFilesUrl || '/apos/annotate-files', [ {
      _id: item._id,
      title: self.$edit.findByName('title').val(),
      credit: self.$edit.findByName('credit').val(),
      description: self.$edit.findByName('description').val(),
      tags: self.$edit.find('[data-name="tags"]').selective('get')
    } ], function(items) {
      _.each(items, function(item) {
        self.updateItem(item);
        self.showItem(item);
      });
      apos.change('media');
      return callback();
    });
  };

  self.deleteItem = function(callback) {
    var item = self.$show.data('item');
    $.jsonCall(options.deleteFileUrl || '/apos/delete-file', {
      _id: item._id
    }, function(result) {
      // Deletion causes issues with pagination, even with
      // infinite scroll - is this page empty now? Simplest to reload.
      // Later we might finesse this more
      self.resetIndex();
      apos.change('media');
      return callback();
    });
  };

  self.rescueItem = function() {
    var item = self.$show.data('item');
    $.jsonCall(options.rescueFileUrl || '/apos/rescue-file', {
      _id: item._id
    }, function(result) {
      // Undeletion causes issues with pagination, even with
      // infinite scroll - is this page empty now? Simplest to reload.
      // Later we might finesse this more
      self.resetIndex();
    });
  };

  self.updateItem = function(item) {
    var $item = self.findItem(item);
    $item.data('item', item);
    self.populateItem($item, item);
  };

  self.findItem = function(item) {
    var result;
    var $items = self.$index.find('[data-item]:not(.apos-template)');
    $.each($items, function() {
      var $item = $(this);
      if ($item.data('item')._id === item._id) {
        result = $item;
      }
    });
    return result;
  };

  self.resetIndex = function() {
    // Clear show pane
    if (self.$edit) {
      self.$edit.remove();
    }
    self.$normal.find('[data-preview]').html('');
    _.each(self.allShow, function(field) {
      self.$normal.find('[data-name="' + field + '"]').html('&mdash;');
    });
    self.$normal.find('[data-edit]').hide();
    self.$normal.find('[data-rescue]').hide();
    self.$normal.show();

    self.$index.trigger('aposScrollReset', self.getCriteria());
  };

  // aposScrollReset causes this to be called
  self.resetCallback = function() {
    self.$index.find('[data-item]:not(.apos-template)').remove();
  };

  self.getCriteria = function() {
    return {
      owner: self.$el.findByName('owner').val(),
      sort: self.$el.findByName('sort').val(),
      trash: self.$el.findByName('trash').val(),
      group: self.$el.findByName('group').val(),
      q: self.$el.findByName('search').val()
    };
  };

  self.moveToScrollTop = function($el) {
    var offset = $el.offset();
    var scrollTop = $(document).scrollTop();
    var showTop = self.$show.offset().top;
    if (scrollTop > (showTop + 20)) {
      offset.top = scrollTop + 20;
    } else {
      offset.top = showTop;
    }
    $el.offset(offset);
  };

  self.fixedHeader = function() {

  };

  // MODAL CALLBACKS

  self.init = function(callback) {
    return callback(null);
  };

  self.afterHide = function(callback) {
    // Stop bottomless interval timer
    self.$el.trigger('aposScrollDestroy');
    return callback(null);
  };
}


