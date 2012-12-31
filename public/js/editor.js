if (!window.jot) {
  window.jot = {};
}

var jot = window.jot;

jot.Editor = function(options) {
  var self = this;
  self.$el = $(options.selector);
  // The contenteditable element inside the wrapper div
  self.$editable = self.$el.find('[data-editable]');

  // We stop these when the editor is destroyed
  self.timers = [];

  self.undoQueue = [];
  self.redoQueue = [];

  // The wrapper is taller than the editor at first, if someone
  // clicks below the editor make sure they still get focus to type
  self.$el.click(function(e) {
    if (e.target === this) {
      self.$editable.focus();
      moveCaretToEnd();
    }
    return false;
  });

  self.$editable.html(options.data);

  // Restore helper marks for widgets
  self.$editable.find('.jot-widget[data-widget-type]').before('↢').after('↣');

  // Restore edit buttons
  self.$editable.find('.jot-widget[data-widget-type]').each(function(i, w) {
    jot.addEditButtonToWidget($(w));
  });

  enableControl('bold', ['meta+b', 'ctrl+b']);
  enableControl('italic', ['meta+i', 'ctrl+i']);
  enableControl('createLink', ['meta+l', 'ctrl+l'], 'URL:');
  enableControl('large');
  enableControl('medium');
  enableControl('small');

  self.$editable.bind('keydown', 'meta+z', function() {
    self.undo();
    return false;
  });

  self.$editable.bind('keydown', 'ctrl+z', function() {
    self.undo();
    return false;
  });

  self.$editable.bind('keydown', 'meta+shift+z', function() {
    self.redo();
    return false;
  });

  self.$editable.bind('keydown', 'ctrl+shift+z', function() {
    self.redo();
    return false;
  });

  self.$editable.bind('keydown', 'del', function() {
    self.undoPoint();
    return true;
  });

  // Firefox displays resize handles we don't want.
  // We prefer to do that via the widget editor
  document.execCommand("enableObjectResizing", false, false);

  self.$editable.bind('cut paste', function() {
    self.undoPoint();
    return true;
  });

  // All buttons that launch editors derived from widgetEditor

  self.$el.find('[data-widgetButton]').click(function() {
    var widgetType = $(this).attr('data-widgetButton');
    new jot.widgetEditors[widgetType]({ editor: self });
    return false;
  }).mousedown(function(e) {
    // Must prevent default on mousedown or the rich text editor loses the focus
    e.preventDefault();
    return false;
  });

  self.$el.on('click', '.jot-edit-widget', function(event) {
    // Necessary so we don't wind up with the selection inside the button
    jot.deselect();
    var $widget = $(this).closest('[data-widget-type]');
    var widgetType = $widget.attr('data-widget-type');
    var widgetId = $widget.attr('data-widget-id');
    new jot.widgetEditors[widgetType](
    {
      editor: self,
      widgetId: widgetId
    });
    return false;
  });

  self.timers.push(setInterval(function() {
    // If the current selection and/or caret moves to 
    // incorporate any part of a widget, expand it to
    // encompass the entire widget and its arrows. Do our best 
    // to avoid direct editing of the widget outside of the
    // widget editor. Eventually the user is trained to
    // just click the edit button when they want to edit the widget
    var sel = rangy.getSelection();
    if (sel.rangeCount) {
      var range = sel.getRangeAt(0);

      // "Why don't you just use intersectNode()?" Because
      // it considers adjacency to be intersection. ):
      self.$editable.find('[data-widget-type]').each(function() {
        try {
          var nodeRange = rangy.createRange();
          nodeRange.setStartBefore(this);
          nodeRange.setEndAfter(this);
          if (range.intersectsRange(nodeRange))
          {
            var left = '↢';
            var right = '↣';
            if (this.previousSibling) {
              var p = this.previousSibling.nodeValue;
              if ((p === left) || (p === right)) {
                nodeRange.setStartBefore(this.previousSibling);
              }
            }
            if (this.nextSibling) {
              var n = this.nextSibling.nodeValue;
              if ((n === left) || (n === right)) {
                nodeRange.setEndAfter(this.nextSibling);
              }
            }
            var unionRange = range.union(nodeRange);
            rangy.getSelection().setSingleRange(unionRange);
          }
        } catch (e) {
          // Don't panic if this throws exceptions while we're inactive
        }
      });
    }
  }, 200));

  self.timers.push(setInterval(function() {
    self.undoPoint();
  }, 5000));

  // We use this to save the selection before starting
  // a widget editor and later restore it
  var selections = [];
  self.pushSelection = function() {
    var sel = rangy.getSelection();
    if (sel && sel.getRangeAt && sel.rangeCount) {
      range = rangy.getSelection().getRangeAt(0);
      selections.push(range);
    }
    else
    {
      selections.push(null);
    }
  };

  self.popSelection = function() {
    self.$editable.focus();
    var range = selections.pop();
    if (range) {
      sel = rangy.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
  };

  self.destroy = function() {
    _.map(self.timers, function(timer) { clearInterval(timer); });
  };

  /**
   * Create a new undo point
   */

  self.undoPoint = function() {
    self.redoQueue = [];
    self.undoStep(null, self.undoQueue, true);
  };

  /**
   * Undo one action
   */
  
  self.undo = function() {
    self.undoStep(self.undoQueue, self.redoQueue);
  };

  /**
   * Redo one action
   */

  self.redo = function() {
    self.undoStep(self.redoQueue, self.undoQueue);
  };

  /**
   * Capture the current state and add it to the 'to' queue.
   * Then pop the most recent state from the 'from' queue and
   * restore that state. To implement undo, call this with
   * self.undoQueue, self.redoQueue. To implement redo, call
   * this with self.redoQueue, self.undoQueue. To save the 
   * current state to the undo queue if a change is detected,
   * call this with null, self.undoQueue, true. 
   */ 

  self.undoStep = function(from, to, optional) {
    // If our purpose is to restore something via 'from' but there
    // are no saved states there, then don't push the current
    // state on 'to' either - just return. In other words, if
    // the user keeps wailing on control-z after they have
    // run out of states to undo, don't pile up a bunch of
    // identical redo states
    if (from && (!from.length)) {
      return;
    }
    if (to) {
      var markup = self.$editable.html();
      var lastMarkup = to.length ? to[to.length - 1].markup : null;
      if ((!optional) || (markup !== lastMarkup)) {
        var selection = rangy.saveSelection();
        to.push({ markup: self.$editable.html(), selection: selection });
        rangy.removeMarkers(selection);
      }
    }
    if (from && from.length) {
      var last = from.pop();
      self.$editable.html(last.markup);
      rangy.restoreSelection(last.selection);
    }
  };

  self.html = function() {
    return self.$editable.html();
  };

  function enableControl(command, keys, promptForLabel) {
    self.$el.find('[data-' + command + ']').click(doCommand).mousedown(function(e) {
      // Must prevent default on mousedown or the rich text editor
      // loses the focus
      e.preventDefault();
      return false;
    });

    if (keys) {
      _.each(keys, function(key) {
        self.$editable.bind('keydown', key, doCommand);
      });
    }

    // function findCurrentBlockElement() {
    //   var range = rangy.getSelection().getRangeAt(0);
    //   var node = range.startContainer;
    //   var offset = range.startOffset;
    //   if (node.nodeType === 3) {


    //   }

    // }

    function doCommand() {
      var arg = null;

      self.undoPoint();

      var actualCommand = command;
      if (command === 'large') {
        actualCommand = 'formatBlock';
        arg = 'h4';
      } else if (command === 'medium') {
        actualCommand = 'formatBlock';
        arg = 'div';
      }

      if (promptForLabel) {
        arg = prompt(promptForLabel);
        if (!arg) {
          return false;
        }
      }

      document.execCommand(actualCommand, false, arg);

      // The easiest way to shut off an h4 is to toggle it
      // to a div with formatBlock. But Firefox won't toggle a div 
      // back to an h4. It strongly prefers br's as line breaks. 
      // So after inserting the div, convert any divs found 
      // into text nodes surrounded by br's. This can be 
      // slightly surprising, but the end result is editable,
      // so you can get back to what you started with.

      // However we also avoid creating a double <br /> situation
      // so that if we keep toggling we don't keep adding new lines.

      // We don't use this hack in webkit because webkit prefers
      // to insert divs and toggles divs to h4's just fine.

      if (jQuery.browser.mozilla) {
        self.$editable.find('div').each(function() {
          var div = $(this);
          if (div.html().length) {
            var markup = '';
            if (div.prev().length && (div.prev()[0].nodeName !== 'BR'))
            {
              markup += "<br />";
            }
            markup += div.html() + '<br />';
            div.replaceWith(markup);
          } else {
            div.remove();
          }
        });
      }

      return false;
    }
  }

  setTimeout(function() {
    self.undoPoint();
  }, 200);
};

// We need to be able to do this to every existing widget preview quickly when
// the edit view starts up

jot.addEditButtonToWidget = function($widget) {
  var edit = $('<div class="jot-edit-widget">Edit ' + jot.widgetEditorLabels[$widget.attr('data-widget-type')] + '</div>');
  $widget.prepend(edit);
};

jot.WidgetEditor = function(options) {
  var self = this;
  self.editor = options.editor;
  self.timers = [];
  self.exists = false;
  if (options.widgetId) {
    self.exists = true;
    self.$widget = options.editor.$editable.find('[data-widget-id="' + options.widgetId + '"]');
  }
  self.widgetId = options.widgetId ? options.widgetId : jot.generateId();

  // Make sure the selection we return to 
  // is actually on the editor
  self.editor.$editable.focus();
  self.editor.pushSelection();
  // Make our own instance of the image editor template
  // so we don't have to fuss over old event handlers
  self.$el = $(options.template + '.jot-template').clone();
  self.$el.removeClass('.jot-template');
  self.$previewContainer = self.$el.find('.jot-widget-preview-container');
  if (self.afterCreatingEl) {
    self.afterCreatingEl();
  }
  self.$el.find('[data-action="dismiss"]').click(function() {
    self.destroy();
  });
  self.$el.find('input[type=radio]').change(function() {
    self.changeSizeAndPosition();
  });
  $('body').append(self.$el);

  _.defaults(self, {
    destroy: function() {
      self.modal('hide');
      _.map(self.timers, function(timer) { clearInterval(timer); });
      // Let it go away pretty, then remove it from the DOM
      setTimeout(function() {
        self.$el.remove();
      }, 500);
      // Return focus to the main editor
      self.editor.$editable.focus();
    },
    getSizeAndPosition: function() {
      var size = self.$el.find('input[name="size"]:checked').val();
      var position = 'middle';
      if (size !== 'full') {
        position = self.$el.find('input[name="position"]:checked').val();
      }
      return { size: size, position: position };
    },
    changeSizeAndPosition: function() {
      var sizeAndPosition = self.getSizeAndPosition();
      self.$previewContainer.find('.jot-widget-preview').removeClass('jot-one-third');
      self.$previewContainer.find('.jot-widget-preview').removeClass('jot-one-half');
      self.$previewContainer.find('.jot-widget-preview').removeClass('jot-two-thirds');
      self.$previewContainer.find('.jot-widget-preview').removeClass('jot-full');
      self.$previewContainer.find('.jot-widget-preview').addClass('jot-' + sizeAndPosition.size);
      if (sizeAndPosition.size === 'full') {
        self.$el.find('.jot-position').hide();
      }
      else
      {
        self.$el.find('.jot-position').show();
      }
      var $preview = self.$previewContainer.find('.jot-widget-preview');
      $preview.removeClass('jot-left');
      $preview.removeClass('jot-middle');
      $preview.removeClass('jot-right');
      $preview.addClass('jot-' + sizeAndPosition.position);
    },

    // This creates the placeholder displayed for this widget in the
    // editor. Placeholders are subject to the following limitations:
    //
    // 1. NO markup that will not copy and paste reliably in every browser.
    // Example: iframes will NOT copy and paste in Firefox.
    //
    // 2. NO JavaScript or event handlers of any kind! The ONLY direct interaction the
    // user has with your placeholder is clicking on it to reopen the widget editor,
    // where you can script anything you wish. Any attempt to move the caret into the
    // placeholder selects the entire placeholder to further emphasize to the user that
    // it is a single unit.
    //
    // However you may attach classes and attributes recognized later in a non-editing
    // context which enable javascript to take over and bring the widget to full life once
    // saved content is being displayed to an end user.
    //
    // Example: a suitable widget placeholder for a video is a thumbnail of the video
    // with a play button superimposed on it and data attributes that allow javascript
    // to figure out how to really play the video later in a non-editing context.
    // The video can also be played in the widget editor.
    //
    // Typically you will not override createWidget, instead you'll just override
    // afterUpdateWidget. 

    createWidget: function() {
      self.$widget = $('<div></div>');
      // self.$widget.attr('unselectable', 'on');
      self.$widget.addClass('jot-widget');
      self.$widget.addClass('jot-' + self.type.toLowerCase());
      self.$widget.attr('data-widget-type', self.type);
      self.$widget.attr('data-widget-id', self.widgetId);
    },

    // Update the widget placeholder to reflect the new
    // size and position, then call self.populateWidget to insert
    // any custom content that makes this placeholder a good
    // respresentation of its widget type (an image, for instance).
    // Note: you should append elements rather than clearing out
    // what is there so that the edit button and any other controls
    // added at this level can stick around

    updateWidget: function() {
      var sizeAndPosition = self.getSizeAndPosition();
      self.$widget.attr({
        'data-size': sizeAndPosition.size,
        'data-position': sizeAndPosition.position
      });
      self.$widget.removeClass('jot-left').
        removeClass('jot-middle').
        removeClass('jot-right').
        removeClass('jot-one-third').
        removeClass('jot-one-half').
        removeClass('jot-two-thirds').
        removeClass('jot-full').
        addClass('jot-' + sizeAndPosition.size).
        addClass('jot-' + sizeAndPosition.position);
      // When we update the widget placeholder we also clear its
      // markup and call populateWidget to insert the latest 
      self.$widget.html('');
      jot.addEditButtonToWidget(self.$widget);
      self.populateWidget();
    },

    insertWidget: function() {
      var markup = '';
      // These make it easy to see where the float
      // is connected to the body and also simplify selecting
      // the image with the keyboard
      var surroundings = {
        left: { before: '↢', after: '↣' },
        right: { before: '↣', after: '↢' },
        middle: { before: '↢', after: '↣' }
      };
      var surrounding = surroundings[sizeAndPosition.position];
      if (surrounding) {
        markup = surrounding.before;
      }
      // Make a temporary div so we can ask it for its HTML and
      // get the markup for the widget placeholder
      var widgetWrapper = $('<div></div>').append(self.$widget);
      markup += widgetWrapper.html();
      if (surrounding) {
        markup = markup + surrounding.after;
      }
      // Make sure the current selection is in the document, not the widget editor
      self.editor.popSelection();
      // Not we can insert the markup
      jot.insertHtmlAtCursor(markup);
      if (options.hint) {
        options.hint('arrows', '"What\'s up with the little arrows?" They are there to show you where to enter text before and after your rich content. Always type text before or after the arrows, never between them. Select both arrows to select your rich content. Click directly on the rich content to edit it. Don\'t worry, the arrows automatically disappear later.');
      }
    },

    modal: function(command) {
      if (command === 'hide') {
        $('.jot-modal-blackout').remove();
        self.$el.hide();
      } else {
        var blackout = $('<div class="jot-modal-blackout"></div>');
        $('body').append(blackout);
        self.$el.offset({ top: $('body').scrollTop() + 200, left: ($(window).width() - 600) / 2 });
        $('body').append(self.$el);
        self.$el.show();
      }
    }
  });

  self.$el.find('.jot-save').click(function() {
    self.editor.undoPoint();
    self.preSave(function() {
      if (!self.exists) {
        alert(options.messages.missing);
        return false;
      }
      var _new = false;
      if (!self.$widget) {
        self.createWidget();
        _new = true;
      }
      self.updateWidget();
      if (_new) {
        self.insertWidget();
      }
      self.destroy();
      return false;
    });
  });

  // Override if you need to carry out an action such
  // as fetching video information before the save can 
  // take place. Takes a callback which completes the
  // save operation, or gracefully refuses it if you
  // don't set self.exists to true. Use of a callback
  // allows you to asynchronously fetch video information, etc.
  if (!self.preSave) {
    self.preSave = function(callback) {
      callback();
    }
  }

  var sizeAndPosition = { size: 'two-thirds', position: 'middle' };
  if (self.exists) {
    sizeAndPosition.size = self.$widget.attr('data-size');
    sizeAndPosition.position = self.$widget.attr('data-position');
  }
  self.$el.find('input[name="size"]').prop('checked', false);
  self.$el.find('input[name="size"][value="' + sizeAndPosition.size + '"]').prop('checked', true);
  self.$el.find('input[name="position"]').prop('checked', false);
  self.$el.find('input[name="position"][value="' + sizeAndPosition.position + '"]').prop('checked', true);

  self.preview();

  self.modal();
}

jot.widgetEditors = {};
jot.widgetEditorLabels = {};

jot.widgetEditors.Image = function(options) {
  var self = this;

  if (!options.messages) {
    options.messages = {};
  }
  if (!options.messages.missing) {
    options.messages.missing = 'Upload an image file first.';
  }

  self.afterCreatingEl = function() {
    console.log(self.$el.length);
    console.log(self.$el[0]);
    console.log(self.$el.find('[data-iframe-placeholder]').length);
    self.$el.find('[data-iframe-placeholder]').replaceWith($('<iframe id="iframe-' + self.widgetId + '" name="iframe-' + self.widgetId + '" class="jot-file-iframe" src="/jot/file-iframe/' + self.widgetId + '"></iframe>'));
    self.$el.bind('uploaded', function(e, id) {
      // Only react to events intended for us
      if (id === self.widgetId) {
        self.exists = true;
        self.preview();
      }
    });
    // Image info
    self.info = {};
  };

  self.preview = function() {
    self.$previewContainer.find('.jot-widget-preview').remove();
    if (self.exists) {
      $.getJSON('/jot/file-info/' + self.widgetId, function(infoArg) {
        info = infoArg;
        var $player = self.getPreviewEmbed();
        self.$previewContainer.prepend($player);
        self.$el.find('.jot-requires-preview').show();
        self.changeSizeAndPosition();
      });
    }
    else
    {
      self.$el.find('.jot-requires-preview').hide();
    }
  };

  self.getImageUrl = function() {
    var size = self.getSizeAndPosition().size;
    // Add a random salt to the image URL to ensure the browser's
    // cache doesn't show us an old copy if we replace a file
    return info.url + '.' + size + '.' + info.extension + '?salt=' + Math.floor(Math.random() * 1000000000);
  };

  self.populateWidget = function() {
    var img = $('<img />');
    img.attr('src', self.getImageUrl());
    self.$widget.append(img);
  }

  self.getPreviewEmbed = function() {
    var imageUrl = self.getImageUrl();
    var img = $('<img />');
    img.attr('src', imageUrl);
    img.addClass('jot-widget-preview');
    return img;
  };

  self.type = 'Image';
  options.template = '.jot-image-editor';

  // Parent class constructor shared by all widget editors
  jot.WidgetEditor.call(self, options);
}

jot.widgetEditorLabels.Image = 'Image';

jot.widgetEditors.Video = function(options) {
  var self = this;
  self.videoUrl = null;
  self.videoInfo = null;

  if (!options.messages) {
    options.messages = {};
  }
  if (!options.messages.missing) {
    options.messages.missing = 'Paste a video link first.';
  }

  self.afterCreatingEl = function() {
    if (self.exists) {
      self.videoUrl = self.$widget.attr('data-video-url');
    }
    self.$embed = self.$el.find('.jot-embed');
    self.$embed.val(self.videoUrl);
    if (self.videoUrl) {
      getVideoInfo();
    }

    // Automatically preview if we detect something that looks like a
    // fresh paste
    var last = '';
    self.timers.push(setInterval(function() {
      var next = self.$embed.val();
      if (interestingDifference(last, next))
      {
        getVideoInfo();
      }
      last = next;

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
    }, 500));

    self.$el.find('.jot-preview-button').click(function() {
      getVideoInfo();
      return false;
    });
  };

  self.getImageUrl = function() {
    if (self.videoInfo) {
      return self.videoInfo.thumbnailUrl;
    }
    return null;
  };

  self.getPreviewEmbed = function() {
    if (!self.videoInfo) {
      return null;
    }
    return $(self.videoInfo.embed).addClass('jot-widget-preview');
  };

  self.preSave = getVideoInfo;

  self.populateWidget = function() {
    self.$widget.attr('data-video-url', self.videoInfo.url);
    var img = $('<img />');
    img.attr('src', self.videoInfo.thumbnailUrl);
    self.$widget.append(img);
  };

  self.preview = function() {
    self.$previewContainer.find('.jot-widget-preview').remove();
    if (self.exists) {
      var $player = getVideoEmbed();
      self.$previewContainer.prepend($player);
      self.$el.find('.jot-requires-preview').show();
      self.changeSizeAndPosition();
    }
    else
    {
      self.$el.find('.jot-requires-preview').hide();
    }
  }

  function getVideoInfo(callback) {
    var url = self.$embed.val();
    // Lazy URLs
    if (!url.match(/^http/))
    {
      url = 'http://' + url;
    }
    self.$el.find('[data-preview]').hide();
    self.$el.find('[data-spinner]').show();
    $.getJSON('/jot/oembed', { url: url }, function(data) {
      self.$el.find('[data-spinner]').hide();
    self.$el.find('[data-preview]').show();
      if (data.err) {
        if (callback) {
          callback(false);
        }
        return;
      }
      var info = {
        url: url,
        thumbnailUrl: data.thumbnail_url,
        embed: data.html.replace(/width="\d+"/, '').replace(/height="\d+"/, '')
      };
      self.videoInfo = info;
      self.exists = !!info;
      self.preview();
      if (callback) {
        callback();
      }
    });
  }

  function getVideoEmbed() {
    if (!self.videoInfo) {
      return '';
    }
    // assumes there's a wrapper
    return $(self.videoInfo.embed).addClass('jot-widget-preview');
    // return '<iframe class="widget-preview youtube-player" type="text/html" src="http://www.youtube.com/embed/' + id + '" frameborder="0"></iframe>';
  }

  self.type = 'Video';
  options.template = '.jot-video-editor';

  // Parent class constructor shared by all widget editors
  jot.WidgetEditor.call(self, options);
}

jot.widgetEditorLabels.Video = 'Video';

// TODO copy current selection's text to pullquote
jot.widgetEditors.Pullquote = function(options) {
  var self = this;
      
  self.pullquote = '“”';

  if (!options.messages) {
    options.messages = {};
  }
  if (!options.messages.missing) {
    options.messages.missing = 'Type in a pullquote first.';
  }

  self.afterCreatingEl = function() {
    if (self.exists) {
      self.pullquote = self.$widget.find('.jot-pullquote-text').text();
    }
    self.$pullquote = self.$el.find('.jot-embed');
    self.$pullquote.val(self.pullquote);
    setTimeout(function() {
      self.$pullquote.focus();
      self.$pullquote.setSelection(1, 1);
    }, 500);

    // Automatically preview if we detect something that looks like a
    // fresh paste
    var last = '';
    self.timers.push(setInterval(function() {
      var next = self.$pullquote.val();
      self.exists = (next.length > 2);
      if (next !== last) {
        self.preview();
      }
      last = next;
    }, 500));
  };

  self.getPreviewEmbed = function() {
    return $('<div class="jot-pullquote jot-widget-preview"></div>').text(self.$pullquote.val());
  };

  self.populateWidget = function() {
    var span = $('<span class="jot-pullquote-text"></span>');
    span.text(self.$pullquote.val());
    self.$widget.append(span);
  }

  self.preview = function() {
    self.$previewContainer.find('.jot-widget-preview').remove();
    var $preview = self.getPreviewEmbed();
    self.$previewContainer.prepend($preview);
    self.$el.find('.jot-requires-preview').show();
    self.changeSizeAndPosition();
  }

  self.type = 'Pullquote';
  options.template = '.jot-pullquote-editor';

  // Parent class constructor shared by all widget editors
  jot.WidgetEditor.call(self, options);
}

jot.widgetEditorLabels.Pullquote = 'Pullquote';

// TODO copy current selection's text to code

jot.widgetEditors.Code = function(options) {
  var self = this;
      
  self.code = '';

  if (!options.messages) {
    options.messages = {};
  }
  if (!options.messages.missing) {
    options.messages.missing = 'Paste in some source code first.';
  }

  self.afterCreatingEl = function() {
    if (self.exists) {
      self.code = self.$widget.text();
    }
    self.$code = self.$el.find('.jot-code');
    self.$code.val(self.code);
    setTimeout(function() {
      self.$code.focus();
      self.$code.setSelection(0, 0);
    }, 500);

    // Automatically preview if we detect something that looks like a
    // fresh paste
    var last = '';
    self.timers.push(setInterval(function() {
      var next = self.$code.val();
      self.exists = (next.length > 2);
      if (next !== last) {
        self.preview();
      }
      last = next;
    }, 500));
  };

  self.getPreviewEmbed = function() {
    return $('<pre class="jot-code jot-widget-preview"></pre>').text(self.$code.val());
  };

  self.populateWidget = function() {
    var pre = $('<pre class="jot-code-pre"></pre>');
    pre.text(self.$code.val());
    self.$widget.append(pre);
  }

  self.preview = function() {
    self.$previewContainer.find('.jot-widget-preview').remove();
    var $preview = self.getPreviewEmbed();
    self.$previewContainer.prepend($preview);
    self.$el.find('.jot-requires-preview').show();
    self.changeSizeAndPosition();
  }

  self.type = 'Code';
  options.template = '.jot-code-editor';

  // Parent class constructor shared by all widget editors
  jot.WidgetEditor.call(self, options);
}

jot.widgetEditorLabels.Code = 'Code Sample';

// Utility methods

jot.generateId = function() {
  return 'w-' + Math.floor(Math.random() * 1000000000) + Math.floor(Math.random() * 1000000000);
}

// mustache.js solution to escaping HTML (not URLs)
jot.entityMap = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': '&quot;',
  "'": '&#39;',
  "/": '&#x2F;'
};

jot.escapeHtml = function(string) {
  return String(string).replace(/[&<>"'\/]/g, function (s) {
    return jot.entityMap[s];
  });
};

jot.hint = function(name, text) {
  // $('.jot-hints').text(text);
  // $('.jot-hints').show();
};

// http://stackoverflow.com/questions/2937975/contenteditable-text-editor-and-cursor-position

jot.insertHtmlAtCursor = function(html) {
  // If I use this, I lose the class of any div I insert in Chrome.
  // if (navigator.browser !== 'Microsoft Internet Explorer') {
  //   document.execCommand('insertHTML', false, html);
  //   return;
  // }

  // Insert it as if we just typed it. So the caret
  // moves after it.
  var sel = rangy.getSelection();
  if (sel.rangeCount) {
    var range = sel.getRangeAt(0);
    var node = range.createContextualFragment(html);
    range.collapse(false);
    range.insertNode(node);
    
    // We can't do this and use a contextual fragment at the
    // same time. But we need a fragment to deal with 
    // multiple tags in an insert.

    // range.setStartAfter(node);
    // range.setEndAfter(node);
    // sel.setSingleRange(range);
  }  
};

jot.deselect = function() {
  rangy.getSelection().removeAllRanges();
};

jot.selectElement = function(el) {
  var range = rangy.createRange();
  range.setStartBefore(el);
  range.setEndAfter(el);
  var sel = rangy.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
};

// Move the caret to the specified offset in characters
// within the specified element. 
jot.moveCaretToTextPosition = function(el, offset) {
  var range = rangy.createRange();
  range.setStart(el, offset);
  range.setEnd(el, offset);
  var sel = rangy.getSelection();
  sel.setSingleRange(range);
};

jot.moveCaretToEnd = function() {
  var last = self.$editable.contents().find(':last');
  if (last.length) {
    moveCaretToTextPosition(last[0], last.text().length);
  }
};

jot.enableAreas = function() {
  $('.jot-edit-area').click(function() {
    
    var area = $(this).closest('.jot-area');
    var slug = area.attr('data-jot-slug');
    
    $.get('/jot/edit-area', { slug: slug }, function(data) {
      area.find('.jot-edit-view').remove();
      var editView = $('<div class="jot-edit-view"></div>');
      editView.append($(data));
      area.append(editView);
      area.find('.jot-normal-view').hide();

      area.find('[data-cancel-area]').click(function() {
        var area = $(this).closest('.jot-area');
        area.find('.jot-edit-view').remove();
        area.find('.jot-normal-view').show();
        return false;
      });

      area.find('[data-save-area]').click(function() {
        var area = $(this).closest('.jot-area');
        var slug = area.attr('data-jot-slug');
        $.post('/jot/edit-area', { slug: slug, content: area.find('[data-editable]').html() }, function(data) {
          area.find('.jot-edit-view').remove();
          area.find('.jot-content').html(data);
          area.find('.jot-normal-view').show();
          jot.enablePlayers(area);
        });
        return false;
      });
    });
    return false;
  });
};
