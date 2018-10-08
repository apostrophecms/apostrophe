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

  self.oembedType = apos.data.widgetOptions[self.type].oembedType;
  self.oembedNotType = apos.data.widgetOptions[self.type].oembedNotType;

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
        type: self.oembedType,
        notType: self.oembedNotType
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
            self.$alwaysIframe.prop('checked', !!video.alwaysIframe);
            return true;
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

    // Used by subclasses like embed, not present in the
    // video widget, but harmless here
    self.$alwaysIframe = self.$el.find('[data-always-iframe]');
    self.$iframeOptions = self.$el.find('[data-iframe-options]');
    self.$iframeHeight = self.$el.find('[data-iframe-height]');
    if (self.data.alwaysIframe) {
      self.$alwaysIframe.prop('checked', true);
    }

    self.$alwaysIframe.change(function() {
      if (self.$alwaysIframe.prop('checked')) {
        self.$iframeOptions.show();
      } else {
        self.$iframeOptions.hide();
      }
      self.preview();
    });

    self.$iframeHeight.change(function() {
      self.preview();
    });

    if (self.data.iframeHeight) {
      self.$iframeHeight.val(self.data.iframeHeight);
    }

    self.$alwaysIframe.trigger('change');

    function interestingDifference(last, next) {
      var i;
      // Only increased length is automatically interesting
      if (next.length - last.length > 10) {
        return true;
      }
      var min = Math.min(last.length, next.length);
      var diff = 0;
      for (i = 0; (i < min); i++) {
        if (last.charAt(i) !== next.charAt(i)) {
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

  self.getVideoInfo = function(callback) {
    var url = self.$embed.val();
    if (!url) {
      return callback('empty');
    }
    // Lazy URLs
    if (!url.match(/^http/))
    {
      url = 'http://' + url;
    }
    var alwaysIframe = self.$alwaysIframe.prop('checked');
    var iframeHeight = self.$iframeHeight.val();
    self.$el.find('[data-preview]').hide();
    self.$el.find('[data-spinner]').show();
    $.getJSON('/apos/oembed', { url: url, alwaysIframe: alwaysIframe, iframeHeight: iframeHeight }, function(data) {
      if (data.err) {
        if (callback) {
          return callback(data.err);
        }
        return;
      }
      if (data) {
        if (self.oembedNotType && (data.type === self.oembedNotType)) {
          alert('That content is not appropriate for this type of widget.');
          return callback && callback(self.oembedNotType);
        }
        if (self.oembedType && (data.type !== self.oembedType)) {
          alert('That content is not appropriate for this type of widget.');
          return callback && callback('not ' + self.oembedType);
        }
      }
      self.exists = !!data;
      if (self.exists) {
        // Make sure the URL and other editable fields are
        // part of the data we pass to our callback
        data.video = url;
        data.alwaysIframe = alwaysIframe;
        data.iframeHeight = iframeHeight;
        // The widget stores just the properties we really need
        // to render
        self.data.video = url;
        self.data.thumbnail = data.thumbnail_url;
        self.data.title = data.title;
        self.data.alwaysIframe = alwaysIframe;
        self.data.iframeHeight = iframeHeight;
      }
      if (callback) {
        return callback(null, data);
      }
    }).error(function() {
      alert('That page does not exist, or you pasted HTML instead of a link, or the domain in question is not whitelisted as safe for inclusion on this site.');
      return callback && callback(self.oembedNotType);
    }).complete(function() {
      self.$el.find('[data-spinner]').hide();
      self.$el.find('[data-preview]').show();
    });
  };

  self.preSave = function(callback) {
    return self.getVideoInfo(function(err, data) {
      if (err) {
        return callback(err);
      }
      // Now that we know it's a keeper, ask the server to
      // remember this video object for reuse
      var video = {};
      // Later there will likely be description and credit here
      video.title = data.title;
      video.video = data.video;
      video.alwaysIframe = data.alwaysIframe;
      video.iframeHeight = data.iframeHeight;

      $.post('/apos/remember-video', video, function(data) {
        self.data.videoId = data._id;
        return callback(null);
      }, 'json');
    });
  };

  self.prePreview = self.getVideoInfo;
}

AposVideoWidgetEditor.label = 'Video';
