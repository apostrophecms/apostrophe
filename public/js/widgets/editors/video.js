/* global rangy, $, _ */
/* global alert, prompt, AposWidgetEditor, apos */

function AposVideoWidgetEditor(options)
{
  var self = this;

  if (!options.messages) {
    options.messages = {};
  }
  if (!options.messages.missing) {
    options.messages.missing = 'Paste a video link first.';
  }

  self.type = options.type || 'video';

  var oembedType = apos.data.widgetOptions[self.type].oembedType;
  var oembedNotType = apos.data.widgetOptions[self.type].oembedNotType;

  // Parent class constructor shared by all widget editors
  AposWidgetEditor.call(self, options);
  // Displays a chooser for selecting existing videos.
  self.enableChooser = function() {
    // This is what we drag to. Easier than dragging to a ul that doesn't
    // know the height of its li's
    var $chooser = self.$el.find('[data-chooser]');
    var $items = $chooser.find('[data-chooser-items]');
    var $search = $chooser.find('[name="search"]');
    var $previous = $chooser.find('[data-previous]');
    var $next = $chooser.find('[data-next]');
    var $removeSearch = $chooser.find('[data-remove-search]');

    var perPage = 21;
    var page = 0;
    var pages = 0;

    self.refreshChooser = function() {
      $.get('/apos/browse-videos', {
        skip: page * perPage,
        limit: perPage,
        q: $search.val(),
        type: oembedType,
        notType: oembedNotType
      }, function(results) {

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
        _.each(results.videos, function(video) {
          var $item = apos.fromTemplate($items.find('[data-chooser-item]'));
          $item.data('video', video);

          // True video: show thumbnail. Everything else: show
          // the title of the embeddable item.
          if (video.type === 'video') {
            // TODO: look into a good routine for CSS URL escaping
            $item.css('background-image', 'url(' + video.thumbnail + ')');
            $item.find('[data-image]').attr('src', video.thumbnail);
            $item.attr('title', video.title);
          } else {
            $item.addClass('apos-not-video');
            $item.text(video.title);
          }
          $items.append($item);

          $item.on('click', function(e) {
            self.$embed.val(video.video);
            return false;
          });
        });
      }).error(function() {
      });
    };

    $previous.on('click', function() {
      if (page > 0) {
        page--;
        self.refreshChooser();
      }
      return false;
    });
    $next.on('click', function() {
      if ((page + 1) < pages) {
        page++;
        self.refreshChooser();
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
      self.refreshChooser();
    }

    // Initial load of chooser contents. Do this after yield so that
    // a subclass like the file widget has time to change self.fileGroup
    apos.afterYield(function() { self.refreshChooser(); });
  };

  self.afterCreatingEl = function() {
    self.$embed = self.$el.find('.apos-embed');
    self.$embed.val(self.data.video);

    function interestingDifference(a, b) {
      var i;
      if (Math.abs(a.length - b.length) > 10) {
        return true;
      }
      var min = Math.min(a.length, b.length);
      var diff = 0;
      for (i = 0; (i < min); i++) {
        if (a.charAt(i) !== b.charAt(i)) {
          diff++;
          if (diff >= 5) {
            return true;
          }
        }
      }
      return false;
    }

    // Automatically preview if we detect something that looks like a
    // fresh paste
    var last = self.data.video ? self.data.video : '';
    self.timers.push(setInterval(function() {
      var next = self.$embed.val();
      if (interestingDifference(last, next))
      {
        self.preview();
      }
      last = next;

    }, 500));

    self.enableChooser();
  };

  function getVideoInfo(callback) {
    var url = self.$embed.val();
    if (!url) {
      return callback('empty');
    }
    // Lazy URLs
    if (!url.match(/^http/))
    {
      url = 'http://' + url;
    }
    self.$el.find('[data-preview]').hide();
    self.$el.find('[data-spinner]').show();
    $.getJSON('/apos/oembed', { url: url }, function(data) {
      self.$el.find('[data-spinner]').hide();
      self.$el.find('[data-preview]').show();
      if (data.err) {
        if (callback) {
          return callback(data.err);
        }
        return;
      }
      if (data) {
        if (oembedNotType && (data.type === oembedNotType)) {
          alert('That content is not appropriate for this type of widget.');
          return callback && callback(oembedNotType);
        }
        if (oembedType && (data.type !== oembedType)) {
          alert('That content is not appropriate for this type of widget.');
          return callback && callback('not ' + oembedType);
        }
      }
      self.exists = !!data;
      if (self.exists) {
        // Make sure the URL is part of the data we pass to our callback
        data.video = url;
        // The widget stores just the properties we really need to render.
        // The preSave callback will also stuff in the id of the video
        // chooser object created at that point
        self.data.video = url;
        self.data.thumbnail = data.thumbnail_url;
        self.data.title = data.title;
      }
      if (callback) {
        return callback(null, data);
      }
    });
  }

  self.preSave = function(callback) {
    return getVideoInfo(function(err, data) {
      if (err) {
        return callback(err);
      }
      // Now that we know it's a keeper, ask the server to remember this
      // video object for reuse (the implementation of which is forthcoming)
      var video = {};
      // Later there will likely be description and credit here
      video.title = data.title;
      video.video = data.video;

      $.post('/apos/remember-video', video, function(data) {
        self.data.videoId = data._id;
        return callback(null);
      }, 'json');
    });
  };

  self.prePreview = getVideoInfo;
}

AposVideoWidgetEditor.label = 'Video';

