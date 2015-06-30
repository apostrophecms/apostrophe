apos.define('apostrophe-media-library', {

  extend: 'apostrophe-modal',

  source: 'media-library',

  construct: function(self, options) {

    self.beforeShow = function(callback) {
      self.findControls();
      self.enableTags();
      self.enableUploads();
      self.enableIndex();
      self.enableSearchField();
      self.enableEditViews();
      self.enableNormalViews();
      return setImmediate(callback);
    };

    self.findControls = function() {
      self.$index = self.$el.find('[data-index]');
      self.$indexItems = self.$el.find('[data-index-items]');
      self.$show = self.$el.find('[data-show]');
      self.$bar = self.$el.find('[data-bar]');
      self.$owner = self.$el.findByName('owner');
      self.$owner.val(options.owner || 'all');
      self.$search = self.$el.find('[name="search"]');
    };

    self.enableTags = function() {
      if (self.options.browseByTag) {
        self.api('tags', {}, function(results) {
          if (results.status === 'ok') {
            // get the element
            var $tag = self.$el.findByName('tag')[0];
            var tag = $tag.selectize.getValue();

            // reset selectize
            $tag.selectize.clear();
            $tag.selectize.clearOptions();
            // load all our tags
            $tag.selectize.load(function(callback) {
              var tags = [];

              // all tags option
              tags.push({ value: '', text: 'All Tags', label: 'All Tags'});

              _.each(results.tags, function(tag) {
                tags.push({ value: tag, text: tag, label:tag });
              });

              return callback(tags);
            });

            $tag.selectize.setValue(tag);

            if (!results.length) {
              self.$el.trigger('aposScrollEnded');
            }
          }
        });
      }
    };

    self.enableIndex = function() {
      self.$indexItems.bottomless({
        url: self.action + '/browse',
        now: true,
        criteria: self.getCriteria()
      });

      self.$indexItems.on('click', '[data-item]', function() {
        self.$indexItems.find('[data-item]').removeClass('active');
        $(this).addClass('active');
        self.showItem($(this).attr('data-item'));
        return false;
      });

      self.$el.on('click', '[data-grid]', function() {
        self.$el.find('[data-index]').removeClass('apos-list-view').addClass('apos-grid-view');
        self.$el.find('.apos-progress-btn').removeClass('active');
        $(this).addClass('active');
        return false;
      });

      self.$el.on('click', '[data-list]', function() {
        self.$el.find('[data-index]').removeClass('apos-grid-view').addClass('apos-list-view');
        self.$el.find('.apos-progress-btn').removeClass('active');
        $(this).addClass('active');
        return false;
      });

      // Filters
      self.$el.on('change', '[name="owner"],[name="trash"],[name="sort"],[name="group"],[name="tag"],[name="extension"]', function() {
        self.resetIndex();
        return false;
      });

    };

    self.enableEditViews = function() {

      // Grab the template from the default content of
      // the show pane so we can clone it as needed
      self.$editViewTemplate = self.$show.find('[data-edit-view]');
      self.$editViewTemplate.remove();
      self.$editViewTemplate.removeClass('apos-template');

      self.$el.on('click', '[data-show] [data-rescue]', function() {
        self.rescueItem(self.$el.find('[data-show]').attr('data-item'));
        return false;
      });

      self.$el.on('click', '[data-show] [data-edit-view] [data-cancel-item]', function() {
        self.showItem();
        return false;
      });

      self.$el.on('click', '[data-show] [data-edit-view] [data-save-item]', function() {
        self.saveItem(function() {
          self.showItem();
        });
        return false;
      });

      self.$el.on('click', '[data-show] [data-edit-view] [data-delete-item]', function() {
        self.deleteItem(function() {
          self.showItem();
        });
        return false;
      });

    };

    self.enableNormalViews = function() {

      self.$el.on('click', '[data-show] [data-edit]', function() {
        self.editItem();
        return false;
      });

    };

    self.enableSearchField = function() {
      // Debounce the textchange event. If we let it fire rapidly,
      // the second set of results may arrive before the first, with
      // irrational results
      var pending = false;
      self.$search.bind('textchange', function() {
        if (!pending) {
          pending = true;
          setTimeout(function() {
            self.resetIndex();
            pending = false;
          }, 500);
        }
      });
    };

    self.enableUploads = function() {
      // Must specifically find the upload button for the
      // index pane, not the edit pane, or drag and drop fires
      // twice. -Tom
      var $uploader = self.$index.find('[data-uploader]');

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
        apos.ui.busy(self.$el.find('.apos-add-files'), state);
      }

      // setup drag-over states
      self.$el.find('.apos-modal-body').bind('dragover', function (e) {
        var dropZone = self.$el.find('.apos-file-container'),
            timeout = self.dropZoneTimeout;
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
        self.dropZoneTimeout = setTimeout(function () {
          self.dropZoneTimeout = null;
          dropZone.removeClass('apos-media-file-in apos-media-file-hover');
        }, 100);
      });

      // Make sure we can indirectly click on an upload button that's been visually replaced with
      // another element. Otherwise only dragging is permissible and in IE nothing is permissible
      self.$el.on('click', '.apos-file-styled', function() {
        $(this).parent().children('input').click();
        return false;
      });
    };

    self.annotateItem = function(item) {
      if (!self.annotator) {
        var annotatorOptions = options.annotator;
        _.defaults(annotatorOptions, {
          receive: function(aItems, callback) {
            // Modified the files, so reset the list view and
            // refresh the content area
            self.resetIndex();
            apos.change('media');
            return callback(null);
          },
          remove: function(aItem) {
            // They removed one of the items during annotation.
            // Reset the list view and refresh the content area
            self.resetIndex();
            apos.change('media');
          },
          destroyed: function() {
            // End of life cycle for previous annotator, note that so
            // we can open another one
            self.annotator = undefined;
          }
        });
        self.annotator = apos.create('apostrophe-annotator', annotatorOptions);
        self.annotator.modal();
      }
      self.annotator.addItem(item);
    };

    self.showItem = function(itemId) {
      if (!itemId) {
        itemId = self.$show.attr('data-item');
      }
      self.$show.attr('data-item', itemId);

      self.html('normal-view', { id: itemId }, function(result) {
        self.$show.html(result);
        self.moveToScrollTop(self.$show);
      });
    };

    self.editItem = function(itemId) {
      if (!itemId) {
        itemId = self.$show.attr('data-item');
      }

      $editView = self.$editViewTemplate.clone();

      self.html('get-one', { id: itemId }, function(result) {
        self.$show.html($editView);

        self.moveToScrollTop(self.$show);
        apos.emit('enhance', self.$show);

        self.enableReplace(itemId);

        return apos.schemas.populate($editView, self.options.schema, result, function(err) {
          if (err) {
            alert('An error occurred. Please try again.');
          }
        });

        function busy(state) {
          apos.ui.busy(self.$el.find('.apos-replace-file'), state);
        }
      });

    };

    self.enableReplace = function(itemId) {
      var url = self.action + '/replace';
      url += '?id=' + itemId;
      var $upload = self.$show.find('[data-uploader]');
      $upload.attr('data-url', url);
      $upload.fileupload({
        dataType: 'json',
        dropZone: self.$show,
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
            self.editItem(data.result.file._id);
            apos.change('media');
          }
        },
      });
    };


    self.saveItem = function(callback) {
      var itemId = self.$show.attr('data-item');
      var file = { _id: itemId };
      return apos.schemas.convert(self.$show, self.options.schema, file, function(err) {
        if (err) {
          alert(err);
          return;
        }
        self.api('annotate', [ file ], function(result) {
          if (result.status == 'ok') {
            _.each(result.files, function(item) {
              item._edit = true;
              self.showItem();
            });
            apos.change('media');
          }
          return callback();
        });
      });
    };

    self.deleteItem = function(callback) {
      var item = self.$show.attr('data-item');
      self.api('delete', {
        _id: item._id
      }, function(result) {
        if (result.status === 'ok') {
          // Deletion causes issues with pagination, even with
          // infinite scroll - is this page empty now? Simplest to reload.
          // Later we might finesse this more
          self.resetIndex();
          apos.change('media');
          return callback();
        } else {
          alert('Error (already deleted?)');
        }
      });
    };

    self.rescueItem = function() {
      var item = self.$show.attr('data-item');
      self.api('rescue', {
        _id: item._id
      }, function(result) {
        if (result.status === 'ok') {
          // Undeletion causes issues with pagination, even with
          // infinite scroll - is this page empty now? Just reload
          self.resetIndex();
        } else {
          alert('Error (already rescued?)');
        }
      });
    };

    self.resetIndex = function() {
      self.$index.trigger('aposScrollReset', self.getCriteria());
      // Clear show pane
      self.$show.attr('data-item', '');
      self.showItem();
    };

    self.getCriteria = function() {
      return {
        owners: true,
        owner: self.$owner.val(),
        sort: self.$el.findByName('sort').val(),
        extension: self.$el.findByName('extension').val(),
        trash: self.$el.findByName('trash').val(),
        group: self.$el.findByName('group').val(),
        tag: self.$el.findByName('tag').val(),
        q: self.$search.val()
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

    self.afterHide = function(callback) {
      // Stop bottomless interval timer
      self.$indexItems.trigger('aposScrollDestroy');
      return callback(null);
    };
  }
});
