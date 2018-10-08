/* global rangy, $, _ */
/* global alert, confirm, prompt, AposWidgetEditor, apos */

function AposSlideshowWidgetEditor(options)
{
  var self = this;

  var $items;
  if (self.fileGroup === undefined) {
    self.fileGroup = 'images';
  }
  var showImages = (options.showImages === undefined) ? true : options.showImages;
  // Options passed from template or other context
  var templateOptions = options.options || {};
  if (templateOptions.group) {
    self.fileGroup = templateOptions.group;
  }
  var widgetClass = templateOptions.widgetClass;
  var aspectRatio = templateOptions.aspectRatio;
  var setSelect = templateOptions.setSelect;
  var minSize = templateOptions.minSize;
  var limit = templateOptions.limit;
  var extraFields = templateOptions.extraFields;
  var liveItem = '[data-item]:not(.apos-template)';
  var userOptions = templateOptions.userOptions || {};
  if (userOptions) {
    var orientation = userOptions.orientation || false;
  }

  if (!options.messages) {
    options.messages = {};
  }
  if (!options.messages.missing) {
    options.messages.missing = 'Upload an image file first.';
  }
  if (!options.alwaysExtraFields) {
    options.alwaysExtraFields = false;
  }

  if(!options.type) {
    self.type = 'slideshow';
  } else {
    self.type = options.type;
  }

  if(!options.template) {
    options.template = '.apos-slideshow-editor';
  }

  // Calls to self.busy are cumulative, so we can figure out when
  // all uploads have stopped
  self._busy = 0;

  // Parent class constructor shared by all widget editors
  AposWidgetEditor.call(self, options);

  // Override methods for this subclass
  self.busy = function(state) {
    apos.busy(self.$el, state);
  };

  // Confirm before cancelling the slideshow widget as it can contain
  // large amounts of new work that are lost forever. TODO: stop using
  // "confirm" once we have a nicer confirmation modal in A2. Find a
  // good way to avoid being a nag if no work has really been done yet.
  self.beforeCancel = function(callback) {
    if (confirm('Are you sure you want to cancel your edits to this slideshow?')) {
      $('.apos-slideshow-editor-item--info').css('display', 'none');
      return callback(null);
    } else {
      return callback('canceled');
    }
  };

  // Our current thinking is that preview is redundant for slideshows.
  // Another approach would be to make it much smaller. We might want that
  // once we start letting people switch arrows and titles and descriptions
  // on and off and so forth. Make sure we still invoke prePreview

  self.preview = function() {
    self.prePreview(function() { });
  };

  self.afterCreatingEl = function() {
    $items = self.$el.find('[data-items]');
    $items.sortable({
      update: function(event, ui) {
        reflect();
        self.preview();
      }
    });

    self.files = [];

    self.$showTitles = self.$el.findByName('showTitles');
    self.$showDescriptions = self.$el.findByName('showDescriptions');
    self.$showCredits = self.$el.findByName('showCredits');
    self.$showTitles.val(self.data.showTitles ? '1' : '0');
    self.$showDescriptions.val(self.data.showDescriptions ? '1' : '0');
    self.$showCredits.val(self.data.showCredits ? '1' : '0');

    if (userOptions.disableTitles) {
      self.$el.find('[data-name="showTitles"]').hide();
    }
    if (userOptions.disableDescriptions) {
      self.$el.find('[data-name="showDescriptions"]').hide();
    }
    if (userOptions.disableCredits) {
      self.$el.find('[data-name="showCredits"]').hide();
    }

    var $uploader = self.$el.find('[data-uploader]');
    $uploader.fileupload({
      dataType: 'json',
      dropZone: self.$el.find('.apos-ui-modal-body'),
      // This is nice in a multiuser scenario, it prevents slamming,
      // but I need to figure out why it's necessary to avoid issues
      // with node-imagemagick
      sequentialUploads: true,
      start: function (e) {
        self.busy(true);
      },
      // Even on an error we should note we're not spinning anymore
      always: function (e, data) {
        self.busy(false);
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
        if (data.result.files) {
          _.each(data.result.files, function (file) {
            addItem(file);
            annotateItem(file);
          });
          apos.afterYield(self.autocropIfNeeded);
          reflect();
          self.preview();
        }
      },
      add: function(e, data) {
        if (limit && (self.count() >= limit)) {
          alert('You must remove an image before adding another.');
          return false;
        }
        return data.submit();
      }
    });

    var warning = getSizeWarning({ width: 0, height: 0 });
    if (warning) {
      self.$el.find('[data-size-warning]').show().text(warning);
    }

    // setup drag-over states
    self.$el.find('.apos-ui-modal-body').bind('dragover', function (e) {
        var dropZone = self.$el.find('.apos-ui-modal-body'),
            timeout = window.dropZoneTimeout;
        if (!timeout) {
            dropZone.addClass('apos-slideshow-file-in');
        } else {
            clearTimeout(timeout);
        }
        if (e.target === dropZone[0]) {
            dropZone.addClass('apos-slideshow-file-hover');
        } else {
            dropZone.removeClass('apos-slideshow-file-hover');
        }
        window.dropZoneTimeout = setTimeout(function () {
            window.dropZoneTimeout = null;
            dropZone.removeClass('apos-slideshow-file-in apos-slideshow-file-hover');
        }, 100);
    });


    // Implement the aspect ratio constraints of the currently
    // selected orientation and make the appropriate orientation
    // UI button appear active
    self.reflectOrientation = function() {
      self.$el.find('[data-orientation-button]').each(function(){
        $(this).removeClass('active');
      });
      self.$el.find('[data-orientation-button="' + self.data.orientation + '"]').addClass('active');

      var info = _.find(orientation.choices, function(choice) {
        return choice.name === self.data.orientation;
      });

      if (info && info.hasOwnProperty('aspectRatio')) {
        aspectRatio = info.aspectRatio;
      }
      self.autocropIfNeeded();
    };

    // Template offers several orientation/constraint choices
    if (orientation && orientation.choices && orientation.choices.length) {
      var $orientation = self.$el.find('[data-orientation-select]');
      var $oTemplate = $orientation.find('[data-orientation-button].apos-template');
      $oTemplate.remove();
      _.each(orientation.choices, function(choice) {
        var $choice = apos.fromTemplate($oTemplate);
        $choice.attr('title', choice.label);
        $choice.attr('data-orientation-button', choice.name);
        $choice.addClass(choice.css);
        $orientation.append($choice);
      });
      self.$el.find('.apos-ui-modal-body').addClass('apos-select-orientation');

      self.data.orientation = self.data.orientation || orientation.choices[0].name;
      self.reflectOrientation();
    }

    // if template passed extraFields as an object, it is trying to disable certain fields
    // it also needs to be enabled

    if (typeof(extraFields) === 'object'){
      $.each(extraFields, function(key, value) {
        self.$el.find('.apos-ui-modal-body [data-extra-fields-'+key+']').remove();
      });
    }

    // in the event of unstyleable input (firefox), pass clicks from the placeholder to the input
    self.$el.find('[data-file-uploader-status]').on('click', function(){
     self.$el.find('[data-uploader]').trigger('click');
     return false;
    });

    self.$el.find('[data-enable-extra-fields]').on('click', function(){
     self.$el.find('[data-items]').toggleClass('apos-extra-fields-enabled');
     reflect();
    });

    // on Edit button click, reveal extra fields... without breaking toggle
    self.$el.on('click', '[data-extra-fields-edit]', function(){
      var $button = $(this);
      var $ours = $button.closest('[data-item]');
      $ours.toggleClass('apos-slideshow-reveal-extra-fields');
      self.$el.find('[data-item]').not($ours).removeClass('apos-slideshow-reveal-extra-fields');
      return false;
    });

    // on Extra Fields Save, reflect and close Extra Fields
    self.$el.on('click', '[data-extra-fields-save]', function(){
      reflect();
      var $button = $(this);
      $button.closest('[data-item]').removeClass('apos-slideshow-reveal-extra-fields');
      return false;
    });

    // on Crop button click, configure and reveal cropping modal
    self.$el.on('click', '[data-crop]', function() {
      crop($(this).closest('[data-item]'));
    });

    // on Info button click, configure and reveal image information modal
    self.$el.on('click', '[data-info]', function() {
      var info = $(this).closest('[data-item]').data('item');

      var item = $('.apos-slideshow-editor-item--info');
      $(item).css('display', 'block');

      var title = $(item).find('.apos-value[data-name="title"]');
      $(title).text(info.title);

      var date = $(item).find('.apos-value[data-name="date"]');
      $(date).text(info.createdAt );

      var tags = $(item).find('.apos-value[data-name="tags"]');
      var allTags = info.tags;
      var tagString = "";
      for(var i = 0; i < allTags.length; i++)
      {
        if(i == 0)
          tagString += allTags[i];
        else
          tagString += ", " + allTags[i];
      }
      $(tags).text(tagString);

      //change background of image to match info box
      $('.apos-slideshow-editor-item-box').css('background-color', '#989898');
      var background = $(this).closest('.apos-slideshow-editor-item-box')[0];
      $(background).css('background-color', '#e6e6e6');

    });
    self.$el.on('click', '.apos-slideshow-editor-item--info div[info-exit]', function() {
      $('.apos-slideshow-editor-item-box').css('background-color', '#989898');
      var item = $('.apos-slideshow-editor-item--info');
      $(item).css('display', 'none');
    });

    // Select new orientation
    self.$el.on('click', '[data-orientation-button]', function() {
      self.data.orientation = $(this).attr('data-orientation-button');
      self.reflectOrientation();
      return false;
    });

    self.enableChooser = function($chooser) {
      // This is what we drag to. Easier than dragging to a ul that doesn't
      // know the height of its li's
      var $target = self.$el.find('[data-drag-container]');
      var $items = $chooser.find('[data-chooser-items]');
      var $search = $chooser.find('[name="search"]');
      var $previous = $chooser.find('[data-previous]');
      var $next = $chooser.find('[data-next]');
      var $removeSearch = $chooser.find('[data-remove-search]');
      var tags = $chooser.find('[data-tags]').data('tags') || '';
      var tagsArray = tags ? tags.split(',') : [];
      var notTags = $chooser.find('[data-not-tags]').data('not-tags') || '';
      var notTagsArray = notTags ? notTags.split(',') : [];
      var perPage = 21;
      var page = 0;
      var pages = 0;

      function refreshChooser() {
        self.busy(true);
        $.get('/apos/browse-files', {
          skip: page * perPage,
          limit: perPage,
          group: self.fileGroup,
          tags: tagsArray,
          notTags: notTagsArray,
          minSize: minSize,
          q: $search.val()
        }, function(results) {
          self.busy(false);

          pages = Math.ceil(results.total / perPage);

          // do pretty active/inactive states instead of
          // hide / show

          if (page + 1 >= pages) {
            // $next.hide();
            $next.addClass('inactive');
          } else {
            // $next.show();
            $next.removeClass('inactive');
          }
          if (page === 0) {
            // $previous.hide();
            $previous.addClass('inactive');
          } else {
            // $previous.show();
            $previous.removeClass('inactive');
          }

          if ($search.val().length) {
            $removeSearch.show();
          } else {
            $removeSearch.hide();
          }

          $items.find('[data-chooser-item]:not(.apos-template)').remove();
          _.each(results.files, function(file) {
            var $item = apos.fromTemplate($items.find('[data-chooser-item]'));
            $item.data('file', file);
            if (showImages) {
              $item.css('background-image', 'url(' + apos.filePath(file, { size: 'one-sixth' }) + ')');
            }
            $item.attr('title', file.name + '.' + file.extension);
            if ((self.fileGroup === 'images') && showImages) {

              $item.find('[data-image]').attr('src', apos.filePath(file, { size: 'one-sixth' }));
            } else {
              // Display everything like a plain filename, after all we're offering
              // a download interface only here and we need to accommodate all types of
              // files in the same media chooser list
              $item.addClass('apos-not-image');
              $item.text(file.name + '.' + file.extension);
            }
            $items.append($item);

            // DRAG AND DROP FROM LIBRARY TO SLIDESHOW
            // Reimplemented with love by Tom because jquery sortable connectWith,
            // jquery draggable connectToSortable and straight-up jquery draggable all
            // refused to play nice. Was it the file uploader? Was it float vs. non-float?
            // Who knows? This code works!

            (function() {
              var dragging = false;
              var dropping = false;
              var origin;
              var gapX;
              var gapY;
              var width;
              var height;
              var fileUploadDropZone;

              $item.on('mousedown', function(e) {
                // Temporarily disable file upload drop zone so it doesn't interfere
                // with drag and drop of existing "files"
                fileUploadDropZone = $uploader.fileupload('option', 'dropZone');
                // Don't do a redundant regular click event
                $items.off('click');
                $uploader.fileupload('option', 'dropZone', '[data-no-drop-zone-right-now]');
                dragging = true;
                origin = $item.offset();
                gapX = e.pageX - origin.left;
                gapY = e.pageY - origin.top;
                width = $item.width();
                height = $item.height();
                var file = $item.data('file');
                // Track on document so we can see it even if
                // something steals our event
                $(document).on('mouseup.aposChooser', function(e) {
                  if (dragging) {
                    dragging = false;
                    // Restore file uploader drop zone
                    $uploader.fileupload('option', 'dropZone', fileUploadDropZone);
                    // Kill our document-level events
                    $(document).off('mouseup.aposChooser');
                    $(document).off('mousemove.aposChooser');
                    var iOffset = $target.offset();
                    var iWidth = $target.width();
                    var iHeight = $target.height();
                    // Just intersect with the entire slideshow and add it at the end
                    // if there's a match. TODO: it would be slicker to detect where
                    // we fell in the list, but doing that really well probably requires
                    // getting jQuery sortable connectWith to play nicely with us
                    if ((e.pageX <= iOffset.left + iWidth) &&
                      (e.pageX + width >= iOffset.left) &&
                      (e.pageY <= iOffset.top + iHeight) &&
                      (e.pageY + height >= iOffset.top)) {
                      addItem(file);
                      self.autocropIfNeeded();
                    }
                    // Snap back so we're available in the chooser again
                    $item.css('top', 'auto');
                    $item.css('left', 'auto');
                    $item.css('position', 'relative');
                    $('[data-uploader-container]').removeClass('apos-chooser-drag-enabled');
                    return false;
                  }
                  return true;
                });
                $(document).on('mousemove.aposChooser', function(e) {
                  if (dragging) {
                    dropping = true;
                    $('[data-uploader-container]').addClass('apos-chooser-drag-enabled');
                    $item.offset({ left: e.pageX - gapX, top: e.pageY - gapY });
                  }
                });
                return false;
              });

              $item.on('click', function(e){
                var file = $item.data('file');
                if (dropping){
                  dropping = false;
                }
                else {
                  addItem(file);
                  e.stopPropagation();
                  self.autocropIfNeeded();
                }
              });

            })();

          });
        }).error(function() {
          self.busy(false);
        });
      };
      $previous.on('click', function() {
        if (page > 0) {
          page--;
          refreshChooser();
        }
        return false;
      });
      $next.on('click', function() {
        if ((page + 1) < pages) {
          page++;
          refreshChooser();
        }
        return false;
      });
      $chooser.on('click', '[name="search-submit"]', function() {
        search();
        return false;
      });
      $removeSearch.on('click', function() {
        $search.val('');
        search();
        return false;
      });
      $search.on('keydown', function(e) {
        if (e.keyCode === 13) {
          search();
          return false;
        }
        return true;
      });
      function search() {
        page = 0;
        refreshChooser();
      }

      // Initial load of chooser contents. Do this after yield so that
      // a subclass like the file widget has time to change self.fileGroup
      apos.afterYield(function() { refreshChooser(); });
    };

    $choosers = self.$el.find('[data-chooser]');
    $choosers.each(function() {
      self.enableChooser($(this));
    });
    //self.enableChooser();
  };

  function crop($item) {
    var item = $item.data('item');
    var width;
    var height;

    // jcrop includes some tools for scaling coordinates but they are
    // not consistent throughout jcrop, so do it ourselves

    // TODO: get this from the CSS without interfering with the
    // ability of the image to report its true size
    var cropWidth = 770;

    function down(coord) {
      return Math.round(coord * cropWidth / width);
    }

    function up(coord) {
      return Math.round(coord * width / cropWidth);
    }

    function cropToJcrop(crop) {
      return [ down(item.crop.left), down(item.crop.top), down(item.crop.left + item.crop.width), down(item.crop.top + item.crop.height) ];
    }

    function jcropToCrop(jcrop) {
      return {
        top: up(jcrop.y),
        left: up(jcrop.x),
        width: up(jcrop.w),
        height: up(jcrop.h)
      };
    }

    var $cropModal;

    // Cropping modal needs its own busy indicator
    function busy(state) {
      if (state) {
        $cropModal.find('[data-progress]').show();
        $cropModal.find('[data-finished]').hide();
      } else {
        $cropModal.find('[data-progress]').hide();
        $cropModal.find('[data-finished]').show();
      }
    }

    $cropModal = apos.modalFromTemplate('.apos-slideshow-crop', {
      init: function(callback) {
        // Cropping should use the full size original. This gives us both the right
        // coordinates and a chance to implement zoom if desired
        var $cropImage = $cropModal.find('[data-crop-image]');
        busy(true);
        // Load the image at its full size while hidden to discover its dimensions
        // (TODO: record those in the database and skip this performance-lowering hack)
        $cropImage.css('visibility', 'hidden');
        $cropImage.attr('src', apos.data.uploadsUrl + '/files/' + item._id + '-' + item.name + '.' + item.extension);
        $cropImage.imagesReady(function(widthArg, heightArg) {
          // Now we know the true dimensions, record them and scale down the image
          width = widthArg;
          height = heightArg;
          var viewWidth = down(width);
          var viewHeight = down(height);
          $cropImage.css('width', viewWidth + 'px');
          $cropImage.css('height', viewHeight + 'px');
          $cropImage.css('visibility', 'visible');
          var jcropArgs = {};
          if (setSelect) {
            jcropArgs.setSelect = setSelect;
          }
          if (item.crop) {
            jcropArgs.setSelect = cropToJcrop(item.crop);
          }
          if (minSize) {
            jcropArgs.minSize = [ down(minSize[0]), down(minSize[1]) ];
          }
          if (aspectRatio) {
            jcropArgs.aspectRatio = aspectRatio[0] / aspectRatio[1];
          }
          // Pass jcrop arguments and capture the jcrop API object so we can call
          // tellSelect at a convenient time
          $cropImage.Jcrop(jcropArgs, function() {
            $item.data('jcrop', this);
          });
          busy(false);
        });
        return callback(null);
      },

      save: function(callback) {

        var c = $item.data('jcrop').tellSelect();
        // If no crop is possible there may
        // be NaN present. Just cancel with no crop performed
        if ((c.w === undefined) || isNaN(c.w) || isNaN(c.h)) {
          return callback(null);
        }
        // Ask the server to render this crop
        busy(true);
        item.crop = jcropToCrop(c);
        $.post('/apos/crop', { _id: item._id, crop: item.crop }, function(data) {
          reflect();
          $item.removeClass('apos-slideshow-reveal-crop');
          busy(false);
          // update the modal after crop rendered
          self.setItemThumbnail(item, $item);
          return callback(null);
        }).error(function() {
          busy(false);
          alert('Server error, please retry');
          return callback('fail');
        });
      }
    });
  }

  // Counts the list items in the DOM. Useful when still populating it.
  self.count = function() {
    return $items.find(liveItem).length;

  };

  // The server will render an actual slideshow, but we also want to see
  // thumbnails of everything with draggability for reordering and
  // remove buttons.
  //
  // The ids and extras properties are what matters to the server, but we
  // need to maintain the self.data._items field to get the name
  // of the file, etc. for preview purposes.

  self.prePreview = function(callback) {

    $items.find(liveItem).remove();
    var ids = self.data.ids || [];
    var extras = self.data.extras || {};
    var items = self.data._items || [];
    _.each(ids, function(id) {
      var item = _.find(items, function(item) { return item._id === id; });
      // ALWAYS tolerate files that have been removed, as the
      // pages collection doesn't know they are gone
      if (item) {
        // The existing items are not subject to complaints about being too small,
        // pass the existing flag
        addItem(item, true);
      }
    });
  };

  // Prep the data to be saved. If any images need to be autocropped,
  // pause and do that and auto-retry this function.
  self.preSave = function (callback) {
    reflect();

    self.autocropIfNeeded(function() {

      self.data.showTitles = (userOptions.disableTitles) ? false : (self.$showTitles.val() === '1');
      self.data.showDescriptions = (userOptions.disableDescriptions) ? false : (self.$showDescriptions.val() === '1');
      self.data.showCredits = (userOptions.disableCredits) ? false : (self.$showCredits.val() === '1');

      return callback(null);
    });
  };

  // Given a file and its jquery element, this method will
  // update the thumbnail to reflect that file's image or filename,
  // as appropriate to the type

  self.setItemThumbnail = function(item, $item)
  {
    if (_.contains(['gif', 'jpg', 'png'], item.extension)) {
      var url = 'url(' + apos.filePath(item, { size: 'full', crop: item.crop }) + ')';
      $item.find('[data-image-background]').css('background-image', url);
    } else {
      $item.find('[data-image]').parent().addClass('apos-not-image');
      $item.find('[data-image]').parent().append('<span class="apos-file-name">' + item.name + '.' + item.extension + '</span>');
    }
  };

  self.autocropIfNeeded = function(callback) {
    // Perform autocrops if needed
    if (!aspectRatio) {
      return callback && callback();
    }

    // On this invocation we'll crop *one* item, then
    // recursively invoke ourselves until there are no
    // more items, then invoke the callback.
    var found = false;
    $items.find(liveItem).each(function() {
      if (found) {
        return;
      }
      var $item = $(this);
      var item = $item.data('item');
      if (!item) {
        return;
      }
      // Look for an aspect ratio match within 1%. Perfect match is unrealistic because
      // we crop a scaled view and jcrop is only so precise
      // Look at the existing crop's aspect ratio, or the
      // actual image's aspect ratio if there is no existing crop;
      // compare to the current required aspect ratio to decide
      // if we have work to do
      var eWidth = item.crop ? item.crop.width : item.width;
      var eHeight = item.crop ? item.crop.height : item.height;
      if (!within(eWidth / eHeight, aspectRatio[0] / aspectRatio[1], 1.0)) {
        var width, height;
        width = item.width;
        height = Math.round(item.width * aspectRatio[1] / aspectRatio[0]);
        if (height > item.height) {
          height = item.height;
          width = Math.round(item.height * aspectRatio[0] / aspectRatio[1]);
        }
        if (width > item.width) {
          width = item.width;
        }
        if (height > item.height) {
          height = item.height;
        }
        item.crop = {
          top: Math.floor((item.height - height) / 2),
          left: Math.floor((item.width - width) / 2),
          width: width,
          height: height
        };
        self.busy(true);
        var $autocropping = self.$el.find('.apos-autocropping');
        $autocropping.show();
        found = true;
        return $.post('/apos/crop', { _id: item._id, crop: item.crop }, function(data) {
          self.busy(false);
          $autocropping.hide();
          self.setItemThumbnail(item, $item);
          reflect();
          return self.autocropIfNeeded(callback);
        }).error(function() {
          // Update the modal after crop rendered
          self.busy(false);
          $autocropping.hide();
          alert('Server error, please retry');
          return callback && callback('fail');
        });
      }
    });
    if (!found) {
      // No more to autocrop
      return callback && callback();
    }
  };

  // Returns true if b is within 'percent' of a, as a percentage of a
  function within(a, b, percent) {
    var portion = (Math.abs(a - b) / a);
    return (portion < (percent / 100.0));
  }

  function getSizeWarning(item) {
    if (minSize && (((minSize[0]) && (item.width < minSize[0])) ||
        ((minSize[1]) && (item.height < minSize[1])))) {
      if (minSize[0] && minSize[1]) {
        return 'Images must be at least ' + minSize[0] + 'x' + minSize[1] + ' pixels.';
      } else if (minSize.width) {
        return 'Images must be at least ' + minSize[0] + ' pixels wide.';
      } else {
        return 'Images must be at least ' + minSize[1] + ' pixels tall.';
      }
    }
    return undefined;
  }

  function addItem(item, existing) {
    var count = self.count();
    // Refuse to exceed the limit if one was specified
    if (limit && (count >= limit)) {
      alert('You must remove an image before adding another.');
      return;
    }
    if (!existing) {
      var warning = getSizeWarning(item);
      if (warning) {
        alert(warning);
        return;
      }
      if (self.fileGroup && (item.group !== self.fileGroup)) {
        // TODO: push list of allowed file extensions per group to browser side and
        // just list those
        if (self.fileGroup === 'images') {
          alert('Please upload a .gif, .jpg or .png file.');
        } else {
          alert('That file is not in an appropriate format.');
        }
        return;
      }
    }

    var $item = apos.fromTemplate($items.find('[data-item]'));

    self.setItemThumbnail(item, $item);

    // Some derivatives of slideshows use these, some don't. These are
    // not editable fields, they are immutable facts about the file
    $item.find('[data-extension]').text(item.extension);

    /**
     * There is an assumption here that this form will never contain a formBoolean
     *
     */
    $item.find('[data-name]:not(.apos-fieldset-select )').text(item.name);

    $item.find('[data-hyperlink]').val(item.hyperlink);
    $item.find('[data-hyperlink-title]').val(item.hyperlinkTitle);
    $item.findByName('newWindow').val(item.hyperlinkTarget ? '1' : '0' );

    if (extraFields || typeof(extraFields) === 'object') {
      $item.find('[data-remove]').after('<a class="apos-slideshow-control apos-edit" data-extra-fields-edit><i class="icon-cog"></i></a>');
    }
    $item.data('item', item);
    $item.find('[data-remove]').click(function() {
      $item.remove();
      reflect();
      self.preview();
      self.$el.find('[data-limit-reached]').hide();
      self.$el.find('[data-uploader]').prop('disabled',false);
      self.$el.find('[data-drag-container]').removeClass('apos-upload-disabled');
      self.$el.find('[data-drag-message]').text('Drop Files Here.');
      self.$el.find('[data-drag-container]').off('drop');
      return false;
    });
    // So selectize can work
    apos.emit('enhance', $item);

    $items.append($item);
    count++;

    if (limit && (count >= limit)) {
      self.$el.find('[data-limit]').text(limit);
      self.$el.find('[data-limit-reached]').show();
      self.$el.find('[data-uploader]').prop('disabled',true);
      self.$el.find('[data-drag-container]').addClass('apos-upload-disabled');
      self.$el.find('[data-drag-message]').text('Oops! This slideshow is full.');

      // prevents drop action so that users dropping files into
      // a a 'full' slideshow dont get thrown to an image file
      self.$el.find('[data-drag-container]').on(
          'drop',
          function(e){
            if(e.originalEvent.dataTransfer){
              if(e.originalEvent.dataTransfer.files.length) {
                e.preventDefault();
                e.stopPropagation();
              }
            }
          }
      );
    }
  }

  // Update the data attributes to match what is found in the
  // list of items. This is called after remove and reorder events
  function reflect() {

    var $itemElements = $items.find(liveItem);

    // What really matters is self.data.ids and self.data.extras.
    // self.data._items is just a copy of the file object with its
    // extras merged in, provided for read only convenience. But we
    // keep that up to date too so we can render previews and display
    // fields that come from the file and reopen widgets after saving
    // them to the editor but not all the way to the server.

    self.data.ids = [];
    self.data.extras = {};
    self.data._items = [];

    $.each($itemElements, function(i, item) {
      var $item = $(item);

      var info = $item.data('item');
      self.data.ids.push(info._id);
      self.data.extras[info._id] = {
        hyperlink: $item.find('[data-hyperlink]').val(),
        hyperlinkTitle: $item.find('[data-hyperlink-title]').val(),
        hyperlinkTarget: $item.findByName('newWindow').val() === '1',
        crop: info.crop
      };
      // Make sure it's all also visible in ._items
      $.extend(true, info, self.data.extras[info._id]);
      self.data._items.push(info);
    });
    // An empty slideshow is allowed, so permit it to be saved
    // even if nothing has been added
    self.exists = true;
  }

  function annotateItem(item) {
    if (!self.annotator) {
      var Annotator = options.Annotator || window.AposAnnotator;
      self.annotator = new Annotator({
        receive: function(aItems, callback) {
          // If we wanted we could display the title, description and
          // credit somewhere in our preview and editing interface
          return callback(null);
        },
        remove: function(aItem) {
          // They removed (deleted) one of the items during annotation.
          // Trigger the button to remove it from the slideshow too
          var $itemElements = $items.find(liveItem);
          var el = _.find($itemElements, function(el) {
            var $el = $(el);
            return ($el.data('item') === aItem);
          });
          if (el) {
            $(el).find('[data-remove]').click();
          }
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
  }
}

AposSlideshowWidgetEditor.label = 'Slideshow';
