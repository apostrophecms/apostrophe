if (!window.jot) {
  window.jot = {};
}

var jot = window.jot;

// Hopefully I won't need these again as they trash copy and paste between pages 
// jot.widgetBackups = {};

jot.Editor = function(options) {
  var self = this;
  var styleMenu;
  var styleBlockElements;

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

  // A dangerous concept, hopefully we have fixed copy & paste and we don't need them

  // self.updateWidgetBackup = function(id, $widget)
  // {
  //   var wrapper = $('<div></div>');
  //   // Clone it so we don't remove it from the document implicitly
  //   wrapper.append($widget.clone());
  //   jot.widgetBackups[id] = wrapper.html();
  // }

  var $widgets = self.$editable.find('.jot-widget');
  $widgets.each(function() {
    var $widget = $(this);

    var widgetId = $widget.attr('data-id');

    // Undo nasty workarounds for webkit bugs for which we found
    // a better workaround
    $widget.find('.jot-widget-inner').each(function() {
      $(this).replaceWith(this.childNodes);
    });
    $widget.find('.jot-widget-content').removeClass('.jot-widget-content');
    $widget.find('.jot-widget-before').remove();
    $widget.find('.jot-widget-after').remove();

    // Restore edit buttons
    jot.addButtonsToWidget($widget);

    // Snapshot we can restore if contenteditable does something
    // self.updateWidgetBackup(widgetId, $widget);
  });

  self.$editable.bind("dragstart", function(e) {
    return false;
  });

  // Restore helper marks for widgets
  self.$editable.find('.jot-widget[data-type]').before(jot.beforeMarker).after(jot.afterMarker);

  enableControl('bold', ['meta+b', 'ctrl+b']);
  enableControl('italic', ['meta+i', 'ctrl+i']);
  enableControl('createLink', ['meta+l', 'ctrl+l'], 'URL:');
  enableControl('insertUnorderedList', []);

  enableMenu('style', 'formatBlock');

  // Make a note of the style menu element so we can
  // quickly update its value. Also make a map of the
  // block elements the style menu is interested in so we
  // can notice when the selection moves into one.

  styleMenu = self.$el.find('[data-style]');
  styleBlockElements = {};

  jot.log(styleMenu.length);
  styleMenu.find('option').each(function() {
    jot.log(this);
    styleBlockElements[$(this).val()] = true;
  });

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
    new jot.widgetTypes[widgetType].editor({ editor: self });
    return false;
  }).mousedown(function(e) {
    // Must prevent default on mousedown or the rich text editor loses the focus
    e.preventDefault();
    return false;
  });

  // Use .editWidget namespace to avoid multiple binds without
  // bookkeeping
  
  self.$el.off('click.editWidget');

  self.$el.on('click.editWidget', '.jot-edit-widget', function(event) {
    // Necessary so we don't wind up with the selection inside the button
    jot.deselect();
    var $widget = $(this).closest('[data-type]');
    var widgetType = $widget.attr('data-type');
    var widgetId = $widget.attr('data-id');
    new jot.widgetTypes[widgetType].editor(
    {
      editor: self,
      widgetId: widgetId
    });
    return false;
  });

  self.$el.on('click.editWidget', '.jot-insert-before-widget', function(event) {
    // Necessary so we don't wind up with the selection inside the button
    jot.deselect();
    var $widget = $(this).closest('[data-type]');
    var $placeholder = $('<span>Type Here</span>');
    $placeholder.insertBefore($widget);
    // The br ensures that it actually looks like we're typing "before" the
    // widget. Otherwise we are, for all practical purposes, "after" the widget
    // until we press enter, which is totally confusing
    var $br = $('<br />');
    $br.insertBefore($widget);
    jot.selectElement($placeholder[0]);
    // Necessary in Firefox
    self.$editable.focus();
    return false;
  });

  self.$el.on('click.editWidget', '.jot-insert-after-widget', function(event) {
    // Necessary so we don't wind up with the selection inside the button
    jot.deselect();
    var $widget = $(this).closest('[data-type]');
    var $placeholder = $('<span>Type Here</span>');
    $placeholder.insertAfter($widget);
    // Without the $br a cut operation drags the "after" text into
    // the widget turd in Chrome
    var $br = $('<br />');
    $br.insertAfter($widget);
    jot.selectElement($placeholder[0]);
    // Necessary in Firefox
    self.$editable.focus();
    return false;
  });

  self.$el.on('click.editWidget', '.jot-widget', function(event) {
    var $widget = $(this).closest('.jot-widget');
    jot.selectElement($widget[0]);
    return false;
  });

  // Cleanup timer. Responsible for overcoming an abundance of
  // awful things that browsers do when you copy and paste widgets
  // and so forth.

  self.timers.push(setInterval(function() {

    // If we don't have the focus, chill out. This prevents unpleasantness like
    // changing the value of a select element while someone is trying to
    // manually modify it

    if (!self.$editable.is(':focus')) {
      return;
    }

    // Webkit randomly blasts style attributes into pasted widgets and
    // other copy-and-pasted content. Remove this brain damage with a
    // blowtorch 

    self.$editable.find('[style]').removeAttr('style');

    // Webkit loves to nest elements that should not be nested 
    // as a result of copy and paste operations and formatBlock actions. 
    // Flatten the DOM, but don't tangle with anything inside a
    // jot-widget. jot-widgets themselves are fair game.

    self.$editable.find('h1, h2, h3, h4, h5, h6, div').each(function() {
      var outer = $(this);
      if (outer.closest('.jot-widget').length) {
        return;
      }
      $(this).find('h1, h2, h3, h4, h5, h6, div').each(function() {
        var inner = $(this);
        if (inner.parents('.jot-widget').length) {
          return;
        }
        var saved = rangy.saveSelection();
        var next = outer.clone();
        next.html(inner.nextAll());
        $(outer).html(inner.prevAll());
        inner.insertAfter(outer);
        next.insertAfter(inner);
        rangy.restoreSelection(saved);
      });
    });

    // Cleanups per widget

    var $widgets = self.$editable.find('.jot-widget');

    $widgets.each(function() {

      // Restore the before and after markers, which prevent Chrome from doing crazy 
      // things with cut copy paste and typeover

      nodeRange = rangy.createRange();
      var node = this;
      nodeRange.setStartBefore(node);
      nodeRange.setEndAfter(node);
      var before = jot.beforeMarker;
      var after = jot.afterMarker;
      if (node.previousSibling) {
        if (node.previousSibling.nodeValue === null) {
          var p = document.createTextNode(before);
          $(node).before(p);
          jot.log('prepended prev element');
        } else {
          var p = node.previousSibling.nodeValue;
          if (p.substr(p.length - 1, 1) !== before) {
            jot.log('appended prev character');
            node.previousSibling.nodeValue += before;
          }
        }
      }
      if (node.nextSibling) {
        if (node.nextSibling.nodeValue === null) {
          var p = document.createTextNode(after);
          $(node).after(p);
          jot.log('appended next element');
        } else {
          var n = node.nextSibling.nodeValue;
          if (n.substr(0, 1) !== after) {
            node.nextSibling.nodeValue = after + node.nextSibling.nodeValue;
            jot.log('prepended character to next');
          }
        }
      }
    });

    // Selection-related fixups

    var sel = rangy.getSelection();
    if (sel.rangeCount) {

      var range = sel.getRangeAt(0);

      // Figure out what the style menu's current setting should
      // be for the current selection.

      var box = range.startContainer;
      while (box) {
        if (box.tagName) {
          var tag = box.tagName.toLowerCase();
          if (_.has(styleBlockElements, tag)) {
            styleMenu.val(tag);
            break;
          }
        }
        box = box.parentNode;
      }

      // If the current selection and/or caret moves to 
      // incorporate any part of a widget, expand it to
      // encompass the entire widget. Do our best 
      // to avoid direct editing of the widget outside of the
      // widget editor. Eventually the user is trained to
      // just click the edit button when they want to edit the widget

      // "Why don't you just use intersectNode()?" Because
      // it considers adjacency to be intersection. ):
      self.$editable.find('[data-type]').each(function() {
        try {
          var nodeRange = rangy.createRange();
          nodeRange.setStartBefore(this);
          nodeRange.setEndAfter(this);
          if (range.intersectsRange(nodeRange))
          {
            // var unionRange = range.union(nodeRange);
            // rangy.getSelection().setSingleRange(unionRange);
            // TODO give this an intersect option
            self.selectWidgetNode(this);
          }
        } catch (e) {
          // Don't panic if this throws exceptions while we're inactive
        }
      });
    }
  }, 200));

  // Every 5 seconds save an undo point if edits have been made.
  // Exception: don't try if the editor does not have the focus, as the
  // rangy mechanisms we use to look for differences can disrupt the focus in 
  // that case
  self.timers.push(setInterval(function() {
    if (self.$editable.is(':focus')) {
      var sel = rangy.getSelection();
      // We don't want to mess up a selection in the editor either
      if ((!sel.rangeCount) || ((sel.rangeCount === 1) && sel.isCollapsed)) {
        self.undoPoint();
      }
    }
  }, 5000));

  self.destroy = function() {
    jot.log('destroying editor');
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

  // This logic, formerly used to select the arrows, is now used to select
  // the arrows we need to prevent Chrome from doing
  // horrible things on cut and paste like leaving the outer widget div behind. ):
  // Chrome will still leave the arrows behind, because it is evil and wants me
  // to suffer, but we can clean those up in various ways

  // https://bugs.webkit.org/show_bug.cgi?id=12250

  self.selectWidgetNode = function(node) {
    // jot.selectElement(node);
    var sel = rangy.getSelection();
    var nodeRange;
    var range;
    if (sel && sel.rangeCount) {
      range = sel.getRangeAt(0);
    }
    nodeRange = rangy.createRange();
    nodeRange.setStartBefore(node);
    nodeRange.setEndAfter(node);
    var before = jot.beforeMarker;
    var after = jot.afterMarker;
    if (node.previousSibling) {
      var p = node.previousSibling.nodeValue;
      if (p.substr(0, 1) === before) {
        nodeRange.setStart(node.previousSibling, p.length - 1);
      }
    }
    if (node.nextSibling) {
      var n = node.nextSibling.nodeValue;
      if (n.substr(0, 1) === after) {
        nodeRange.setEnd(node.nextSibling, 1);
      }
    }
    if (range && range.intersectsRange(nodeRange)) {
      var unionRange = range.union(nodeRange);
    } else {
      unionRange = nodeRange;
    }
    rangy.getSelection().setSingleRange(unionRange);
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

      if (promptForLabel) {
        arg = prompt(promptForLabel);
        if (!arg) {
          return false;
        }
      }

      document.execCommand(command, false, arg);

      self.$editable.focus();

      return false;
    }
  }

  function enableMenu(name, action) {
    self.$el.find('[data-' + name + ']').change(function() {
      self.undoPoint();
      document.execCommand(action, false, $(this).val());

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

      // Don't do this to divs that are or are inside a jot-widget!

      if (jQuery.browser.mozilla) {
        self.$editable.find('div').each(function() {
          var div = $(this);

          if (div.is('.jot-widget') || div.closest('.jot-widget').length) {
            return;
          }
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
      self.$editable.focus();
    });
  }

  setTimeout(function() {
    self.undoPoint();
  }, 200);
};

// We need to be able to do this to every existing widget preview quickly when
// the edit view starts up

jot.addButtonsToWidget = function($widget) {
  var $buttons = $('<div class="jot-widget-buttons"></div>');
  var $button = $('<div class="jot-widget-button jot-edit-widget">Edit ' + jot.widgetTypes[$widget.attr('data-type')].label + '</div>');
  $buttons.append($button);
  var $button = $('<div class="jot-widget-button jot-insert-before-widget">Before</div>');
  $buttons.append($button);
  var $button = $('<div class="jot-widget-button jot-insert-after-widget">After</div>');
  $buttons.append($button);
  $buttons.append($('<div class="jot-clear"></div>'));
  $widget.prepend($buttons);
};

jot.widgetEditor = function(options) {
  var self = this;
  self.editor = options.editor;
  self.timers = [];
  self.exists = false;

  // What will be in the data attributes of the widget
  self.data = {};

  if (options.widgetId) {
    self.exists = true;
    self.$widget = options.editor.$editable.find('.jot-widget[data-id="' + options.widgetId + '"]');
    self.data = self.$widget.data();
  }

  self.widgetId = options.widgetId ? options.widgetId : jot.generateId();
  self.data.id = self.widgetId;

  // Make sure the selection we return to 
  // is actually on the editor
  self.editor.$editable.focus();
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

    // Create a new widget for insertion into the main content editor.
    // See also the server-side itemNormalView.html template, which
    // does the same thing
    createWidget: function() {
      self.$widget = $('<div></div>');
      // self.$widget.attr('unselectable', 'on');
      self.$widget.addClass('jot-widget');
      self.$widget.addClass('jot-' + self.type);
      self.$widget.attr('data-type', self.type);
      self.$widget.attr('data-id', self.widgetId);
    },

    // Update the widget placeholder in the main content editor to reflect the new
    // size and position, then ask the server to render the widget placeholder.
    // We *don't* call the widget player inside the main content editor because
    // those are not restricted to content that behaves inside contentEditable.

    updateWidget: function(callback) {
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
      jot.addButtonsToWidget(self.$widget);
      self.updateWidgetData();
      self.renderWidget(callback);
    },

    // Widgets now just update self.data as needed so this doesn't
    // need to be overridden typically
    updateWidgetData: function() {
      _.each(self.data, function(val, key) {
        self.$widget.attr('data-' + key, val);
      });
    },

    // Ask the server to render the widget's contents, stuff them into the placeholder
    renderWidget: function(callback) {
      // Get all the data attributes
      var info = self.$widget.data();

      // Some widgets have content - markup that goes inside the widget
      // that was actually written by the user and can't be generated
      // dynamically. Examples: pullquotes, code samples
      if (self.getContent) {
        info.content = self.getContent();
      } else {
        info.content = undefined;
      }

      // Ask the server to generate a nice rendering of the widget's contents
      // for us, via its normal view renderer. This avoids code duplication
      // and an inevitable drift into different behavior between browser
      // and server. At some point perhaps we'll run the same rendering code
      // on both client and server
      $.post('/jot/render-widget?bodyOnly=1&editView=1', info, function(html) {
        self.$widget.append(html);
        callback(null);
      });
    },

    // Insert new widget into the main content editor
    insertWidget: function() {
      var markup = '';

      // Work around serious widget selection bugs in Chrome by introducing
      // characters before and after the widget that become part of selecting it
      var before = jot.beforeMarker;
      var after = jot.afterMarker;

      markup = before;

      var widgetWrapper = $('<div></div>').append(self.$widget);
      markup += widgetWrapper.html();

      markup += after;

      // markup = markup + String.fromCharCode(8288);

      // Restore the selection to insert the markup into it
      jot.popSelection();
      // Not we can insert the markup
      jot.insertHtmlAtCursor(markup);
      // Push the selection again, leaving it up to modal('hide')
      // to do the final restore
      jot.pushSelection();
    },

    modal: function(command) {
      return jot.modal(self.$el, command);
    },

    preview: function() {
      if (self.prePreview) {
        self.prePreview(go);
      } else {
        go();
      }
      function go() {
        self.$previewContainer.find('.jot-widget-preview').remove();
        if (self.exists) {
          // Ask the server to generate a nice preview of the widget's contents
          // for us, via its normal view renderer. This avoids code duplication
          // and an inevitable drift into different behavior between browser
          // and server. At some point perhaps we'll run the same rendering code
          // on both client and server... if it matters, Node is terribly fast
          var info = {};
          _.defaults(info, self.data);
          info.type = self.type;
          var sizeAndPosition = self.getSizeAndPosition();
          info.size = sizeAndPosition.size;
          info.position = sizeAndPosition.position;
          if (self.getContent) {
            info.content = self.getContent();
          } else {
            info.content = undefined;
          }
          $.post('/jot/render-widget', info, function(html) {
            var previewWidget = $(html);
            previewWidget.addClass('jot-widget-preview');
            self.$previewContainer.prepend(previewWidget);
            self.$el.find('.jot-requires-preview').show();
            if (jot.widgetPlayers[self.type]) {
              jot.widgetPlayers[self.type](previewWidget);
            }
          });
        }
        else
        {
          self.$el.find('.jot-requires-preview').hide();
        }
      }
    }
  });

  self.$el.find('.jot-save').click(function() {
    self.preSave(function() {
      self.editor.undoPoint();
      if (!self.exists) {
        alert(options.messages.missing);
        return false;
      }
      var _new = false;
      if (!self.$widget) {
        self.createWidget();
        _new = true;
      }
      self.updateWidget(function(err) {
        if (_new) {
          self.insertWidget();
          // jot.hint('What are the arrows for?', "<p>They are there to show you where to add other content before and after your rich content.</p><p>Always type text before or after the arrows, never between them.</p><p>This is especially helpful when you are floating content next to text.</p><p>You can click your rich content to select it along with its arrows, then cut, copy or paste as usual.</p><p>Don\'t worry, the arrows automatically disappear when you save your work.</p>");
        }
        // Widget backups are probably a bad idea since they would defeat
        // copy and paste between pages or at least sites
        // self.editor.updateWidgetBackup(self.widgetId, self.$widget);
        self.destroy();
      });
    });
    return false;
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

jot.widgetTypes = {};

jot.widgetTypes.image = {
  label: 'Image',
  editor: function(options) {
    var self = this;

    if (!options.messages) {
      options.messages = {};
    }
    if (!options.messages.missing) {
      options.messages.missing = 'Upload an image file first.';
    }

    self.afterCreatingEl = function() {
      self.$el.find('[data-iframe-placeholder]').replaceWith($('<iframe id="iframe-' + self.widgetId + '" name="iframe-' + self.widgetId + '" class="jot-file-iframe" src="/jot/file-iframe/' + self.widgetId + '"></iframe>'));
      self.$el.bind('uploaded', function(e, id) {
        // Only react to events intended for us
        if (id === self.widgetId) {
          self.exists = true;
          self.preview();
        }
      });
    };

    // For images, preview is triggered by an upload. We need to capture
    // the file extension at that point so we are not forced to constantly
    // look it up in a separate collection
    self.prePreview = function(callback) {
      if (self.exists) {
        $.getJSON('/jot/file-info/' + self.widgetId, function(info) {
          self.data.extension = info.extension;
          callback();
        });
      }
      else
      {
        callback();
      }
    };

    self.type = 'image';
    options.template = '.jot-image-editor';

    // Parent class constructor shared by all widget editors
    jot.widgetEditor.call(self, options);
  }
};

jot.widgetTypes.video = {
  label: 'Video',
  editor: function(options) {
    var self = this;

    if (!options.messages) {
      options.messages = {};
    }
    if (!options.messages.missing) {
      options.messages.missing = 'Paste a video link first.';
    }

    self.afterCreatingEl = function() {
      self.$embed = self.$el.find('.jot-embed');
      self.$embed.val(self.data.video);

      // Automatically preview if we detect something that looks like a
      // fresh paste
      var last = '';
      self.timers.push(setInterval(function() {
        var next = self.$embed.val();
        if (interestingDifference(last, next))
        {
          self.preview();
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

    self.preSave = getVideoInfo;

    self.prePreview = getVideoInfo;

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
        self.exists = !!data;
        if (self.exists) {
          self.data.video = url;
          self.data.thumbnail = data.thumbnail_url;
        }
        if (callback) {
          callback();
        }
      });
    }

    self.type = 'video';
    options.template = '.jot-video-editor';

    // Parent class constructor shared by all widget editors
    jot.widgetEditor.call(self, options);
  }
};

jot.widgetTypes.pullquote = {
  label: 'Pullquote',
  editor: function(options) {
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

    self.getContent = function() {
      return self.$pullquote.val();
    }

    self.type = 'pullquote';
    options.template = '.jot-pullquote-editor';

    // Parent class constructor shared by all widget editors
    jot.widgetEditor.call(self, options);
  },

  getContent: function($el) {
    return $el.find('.jot-pullquote-text').text();
  }
};

jot.widgetTypes.code = {
  label: 'Code Sample',
  editor: function(options) {
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
        self.code = self.$widget.find('pre').text();
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

    self.getContent = function() {
      return self.$code.val();
    }

    self.type = 'code';
    options.template = '.jot-code-editor';

    // Parent class constructor shared by all widget editors
    jot.widgetEditor.call(self, options);
  },

  getContent: function($el) {
    return $el.find('pre').text();
  }
};

// Utilities

// Widget ids should be valid names for javascript variables, just in case
// we find that useful, so avoid hyphens

jot.generateId = function() {
  return 'w' + Math.floor(Math.random() * 1000000000) + Math.floor(Math.random() * 1000000000);
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
    
    $.get('/jot/edit-area', { slug: slug, controls: area.attr('data-jot-controls') }, function(data) {
      area.find('.jot-edit-view').remove();
      var editView = $('<div class="jot-edit-view"></div>');
      editView.append($(data));
      area.append(editView);
      area.find('.jot-normal-view').hide();

      area.find('[data-cancel-area]').click(function() {
        destroyEditorAndShowNormalView();
        return false;
      });

      area.find('[data-save-area]').click(function() {
        var slug = area.attr('data-jot-slug');
        $.post('/jot/edit-area', 
          { 
            slug: slug, 
            content: JSON.stringify(
              jot.parseArea(area.find('[data-editable]').html())
            ) 
          }, function(data) {
            area.find('.jot-content').html(data);
            destroyEditorAndShowNormalView();
            jot.enablePlayers(area);
          }
        );
        return false;
      });

      function destroyEditorAndShowNormalView() {
        var $editor = area.find('.jot-editor');
        $editor.data('jot-editor').destroy();
        area.find('.jot-edit-view').remove();
        area.find('.jot-normal-view').show();
      }
    });
    return false;
  });
};

jot.parseArea = function(content) {
  var node = document.createElement('div');
  node.innerHTML = content;
  var children = node.childNodes;
  var items = [];
  var richText = '';
  for (var i = 0; (i < children.length); i++) {
    var child = node.childNodes[i];
    if (child.nodeType === 3) {
      // This is a text node. Take care to escape when appending it to the rich text
      richText += jot.escapeHtml(child.nodeValue);

    } else if (child.nodeType === 1) {
      if (child.getAttribute('data-type')) {
        // This is a widget, it gets its own entry in items
        flushRichText();

        var type = child.getAttribute('data-type');
        var item = {};
        if (jot.widgetTypes[type].getContent) {
          item.content = jot.widgetTypes[type].getContent($(child));
          jot.log(item.content);
        }

        for (var j = 0; (j < child.attributes.length); j++) {
          var key = child.attributes[j].name;
          var value = child.attributes[j].value;
          var matches = key.match(/^data\-(.*)$/);
          if (matches) {
            var name = matches[1];
            item[name] = value;
          }
        }
        items.push(item);
      } else {
        // This is a rich text element like <strong> or <h3>
        //
        // @#)(*$ absence of outerHTML in some browsers, work around that
        // with a lazy but simple jQuery hack
        var wrapper = $('<div></div>');
        wrapper.append($(child).clone());
        richText += wrapper.html();
      }
    }
  }  
  // Don't forget to flush any rich text that appeared after the last widget,
  // and/or if there are no widgets!
  flushRichText();

  return items;

  // Helper functions

  function flushRichText() {
    if (richText.length) {
      items.push({ type: 'richText', content: richText });
      richText = '';
    }
  }
};

jot.modal = function(sel, command) {
  var $el = $(sel);
  if (command === 'hide') {
    $('.jot-modal-blackout').remove();
    $el.hide();
    jot.popSelection();
  } else {
    jot.pushSelection();
    var blackout = $('<div class="jot-modal-blackout"></div>');
    $('body').append(blackout);
    $el.offset({ top: $('body').scrollTop() + 200, left: ($(window).width() - 600) / 2 });
    $('body').append($el);
    $el.show();
  }
};

// Display the hint if the user hasn't seen it already. Use a cookie with an
// array of hint titles to figure out if we've seen it before. TODO: consider
// server side storage of this info, per user, so you don't get hints again on every
// new machine. Move hint titles and markup into something translatable.

jot.hint = function(title, markup) {

  var hints = $.cookie('jot_hints');
  var seen = [];
  if (hints) {
    seen = hints.split("\n");
  }
  if (seen.indexOf(title) !== -1) {
    return;
  }
  $.cookie('jot_hints', hints + "\n" + title, { expires: 999999 });

  // Give the dialog that inspired this hint time to get out of the way
  // (TODO: this is a crude workaround)

  setTimeout(function() {
    var hint = $('.jot-hint.jot-template').clone();
    hint.removeClass('jot-template');
    hint.find('[data-hint-title]').text(title);
    hint.find('[data-hint-text]').html(markup);
    hint.find('[data-hint-ok]').click(function() {
      jot.modal(hint, 'hide');
    });
    jot.modal(hint);
  }, 1000);
}

// We use this to save the selection before starting
// a modal and later restore it

jot.selections = [];

jot.pushSelection = function() {
  var sel = rangy.getSelection();
  if (sel && sel.getRangeAt && sel.rangeCount) {
    range = rangy.getSelection().getRangeAt(0);
    jot.selections.push(range);
  }
  else
  {
    jot.selections.push(null);
  }
};

jot.popSelection = function() {
  var range = jot.selections.pop();
  if (range) {
    sel = rangy.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }
};

// The best marker to use as a workaround for webkit selection bugs
// is an invisible one (the Unicode word joiner character).
jot.beforeMarker = String.fromCharCode(8288); // '↢';
jot.afterMarker = String.fromCharCode(8288); // '↣';

jot.log = function(msg) {
  if (console && jot.log) {
    console.log(msg);
  }
};

