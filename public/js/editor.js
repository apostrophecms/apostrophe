/* global rangy, $, _ */
/* global alert, prompt */

if (!window.apos) {
  window.apos = {};
}

var apos = window.apos;

// Hopefully I won't need these again as they trash copy and paste between pages
// apos.widgetBackups = {};

apos.Editor = function(options) {
  var self = this;
  var styleMenu;
  var styleBlockElements;
  var resizing = false;

  // Helper functions

  function enableControl(command, keys, promptForLabel) {
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

      // Don't do this to divs that are or are inside a apos-widget!

      if (jQuery.browser.mozilla) {
        self.$editable.find('div').each(function() {
          var div = $(this);

          if (div.is('.apos-widget') || div.closest('.apos-widget').length) {
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

  self.$el = $(options.selector);
  // The contenteditable element inside the wrapper div
  self.$editable = self.$el.find('[data-editable]');

  // We stop these when the editor is destroyed
  self.timers = [];

  self.undoQueue = [];
  self.redoQueue = [];

  // We need to be able to do this to every existing widget preview quickly when
  // the edit view starts up

  self.addButtonsToWidget = function($widget) {
    var $buttons = $('<div class="apos-widget-buttons"></div>');
    // var $button = $('<div class="apos-widget-button apos-edit-widget">Edit ' + apos.widgetTypes[$widget.attr('data-type')].label + '</div>');
    var $button = $('<div data-edit-widget class="apos-widget-button apos-edit-widget"><i class="icon-pencil"></i></div>');
    $buttons.append($button);

    $button = $('<div data-float-widget-left class="apos-widget-button apos-float-widget-left"><i class="icon-left-open"></i></div>');  
    $buttons.append($button);
    $button = $('<div data-float-widget-right class="apos-widget-button apos-float-widget-right"><i class="icon-right-open"></div>'); 
    $buttons.append($button);

    $buttons.append($('<div class="apos-clear"></div>'));
    $widget.prepend($buttons);
  };

  // The wrapper is taller than the editor at first, if someone
  // clicks below the editor make sure they still get focus to type
  self.$el.click(function(e) {
    if (e.target === this) {
      self.$editable.focus();
      apos.moveCaretToEnd();
    }
    return false;
  });

  self.$editable.html(options.data);

  var $widgets = self.$editable.find('.apos-widget');
  $widgets.each(function() {
    var $widget = $(this);

    var widgetId = $widget.attr('data-id');

    // Undo nasty workarounds for webkit bugs for which we found
    // a better workaround
    $widget.find('.apos-widget-inner').each(function() {
      $(this).replaceWith(this.childNodes);
    });
    $widget.find('.apos-widget-content').removeClass('.apos-widget-content');
    $widget.find('.apos-widget-before').remove();
    $widget.find('.apos-widget-after').remove();

    // Restore edit buttons
    self.addButtonsToWidget($widget);

    // Snapshot we can restore if contenteditable does something
    // self.updateWidgetBackup(widgetId, $widget);
  });

  self.$editable.bind("dragstart", function(e) {
    return false;
  });

  // Restore helper marks for widgets
  self.$editable.find('.apos-widget[data-type]').before(apos.beforeMarker).after(apos.afterMarker);

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

  styleMenu.find('option').each(function() {
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
    apos.log('instantiating widget type:');
    apos.log(widgetType);
    new apos.widgetTypes[widgetType].editor({ editor: self });
    return false;
  }).mousedown(function(e) {
    // Must prevent default on mousedown or the rich text editor loses the focus
    e.preventDefault();
    return false;
  });

  // Use .editWidget namespace to avoid multiple binds without
  // bookkeeping

  self.$el.off('click.editWidget');

  self.$el.on('click.editWidget', '[data-edit-widget]', function(event) {
    // Necessary so we don't wind up with the selection inside the button
    apos.deselect();
    var $widget = $(this).closest('[data-type]');
    var widgetType = $widget.attr('data-type');
    var widgetId = $widget.attr('data-id');
    new apos.widgetTypes[widgetType].editor(
    {
      editor: self,
      widgetId: widgetId
    });
    return false;
  });

  self.$el.on('click.editWidget', '[data-float-widget-left]', function(event) {
    apos.deselect();
    var $widget = $(this).closest('[data-type]');
    if ($widget.attr('data-position') === 'right') {
      floatWidget($widget, 'middle');
    } else {
      floatWidget($widget, 'left');
    }
    return false;
  });

  self.$el.on('click.editWidget', '[data-float-widget-right]', function(event) {
    apos.deselect();
    var $widget = $(this).closest('[data-type]');
    if ($widget.attr('data-position') === 'left') {
      floatWidget($widget, 'middle');
    } else {
      floatWidget($widget, 'right');
    }
    return false;
  });

  function floatWidget($widget, position) {
    $widget.attr('data-position', position);
    $widget.removeClass('apos-left');
    $widget.removeClass('apos-middle');
    $widget.removeClass('apos-right');
    $widget.addClass('apos-' + position);
  }

  self.$el.on('click.editWidget', '.apos-insert-before-widget', function(event) {
    // Necessary so we don't wind up with the selection inside the button
    apos.deselect();
    var $widget = $(this).closest('[data-type]');
    var $placeholder = $('<span>Type Here</span>');
    $placeholder.insertBefore($widget);
    // The br ensures that it actually looks like we're typing "before" the
    // widget. Otherwise we are, for all practical purposes, "after" the widget
    // until we press enter, which is totally confusing
    var $br = $('<br />');
    $br.insertBefore($widget);
    apos.selectElement($placeholder[0]);
    // Necessary in Firefox
    self.$editable.focus();
    return false;
  });

  self.$el.on('click.editWidget', '.apos-insert-after-widget', function(event) {
    // Necessary so we don't wind up with the selection inside the button
    apos.deselect();
    var $widget = $(this).closest('[data-type]');
    var $placeholder = $('<span>Type Here</span>');
    $placeholder.insertAfter($widget);
    // Without the $br a cut operation drags the "after" text into
    // the widget turd in Chrome
    var $br = $('<br />');
    $br.insertAfter($widget);
    apos.selectElement($placeholder[0]);
    // Necessary in Firefox
    self.$editable.focus();
    return false;
  });

  self.$el.on('click.editWidget', '.apos-widget', function(event) {
    var $widget = $(this).closest('.apos-widget');
    apos.selectElement($widget[0]);
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
    // blowtorch, except during resize when it breaks preview of resize

    if (!resizing) {
      self.$editable.find('[style]').removeAttr('style');
    }

    // Webkit loves to nest elements that should not be nested 
    // as a result of copy and paste operations and formatBlock actions. 
    // Flatten the DOM, but don't tangle with anything inside a
    // apos-widget. apos-widgets themselves are fair game.

    self.$editable.find('h1, h2, h3, h4, h5, h6, div, p').each(function() {
      var outer = $(this);
      if (outer.closest('.apos-widget').length) {
        return;
      }
      $(this).find('h1, h2, h3, h4, h5, h6, div, p').each(function() {
        var inner = $(this);
        if (inner.parents('.apos-widget').length) {
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

    var $widgets = self.$editable.find('.apos-widget');

    $widgets.each(function() {

      var $widget = $(this);
      var $container = $widget.closest('.apos-editor');
      var cellWidth = ($container.outerWidth() / 6)

      // Make widgets resizable if they aren't already


      if (!$widget.data('uiResizable')) {
        $widget.resizable({
          containment: $container,
          grid: cellWidth,
          // helper: "ui-resizable-helper",
          start: function(event, ui) {
            resizing = true;
          },
          stop: function(event, ui) {
            resizing = false;
            var max = $widget.closest('[data-editable]').width();
            var is = ui.size;
            var size = 'full';
            var sizes = [
              { proportion: 1/3, name: 'one-third' },
              { proportion: 1/2, name: 'one-half' },
              { proportion: 2/3, name: 'two-thirds' },
              { proportion: 1.0, name: 'full' }
            ];


            for (var i = 0; (i < sizes.length); i++) {
              if (is.width <= (max * sizes[i].proportion * 1.1)) {
                size = sizes[i].name;
                break;
              }
            }


            $widget.attr('data-size', size);
            _.each(sizes, function(s) {
              $widget.removeClass('apos-' + s.name);
            });

            // console.log(size);

            if (size === 'full') {
              // full implies middle
              $widget.attr('data-position', 'middle');
              $widget.removeClass('apos-left');
              $widget.removeClass('apos-right');
              $widget.addClass('apos-middle');
            }
            $widget.addClass('apos-' + size);
          }
        });
      }
      // Restore the before and after markers, which prevent Chrome from doing crazy 
      // things with cut copy paste and typeover

      var nodeRange = rangy.createRange();
      var node = this;
      nodeRange.setStartBefore(node);
      nodeRange.setEndAfter(node);
      var before = apos.beforeMarker;
      var after = apos.afterMarker;
      var p, n;
      if (node.previousSibling) {
        if (node.previousSibling.nodeValue === null) {
          p = document.createTextNode(before);
          $(node).before(p);
        } else {
          p = node.previousSibling.nodeValue;
          if (p.substr(p.length - 1, 1) !== before) {
            node.previousSibling.nodeValue += before;
          }
        }
      }
      if (node.nextSibling) {
        if (node.nextSibling.nodeValue === null) {
          p = document.createTextNode(after);
          $(node).after(p);
        } else {
          n = node.nextSibling.nodeValue;
          if (n.substr(0, 1) !== after) {
            node.nextSibling.nodeValue = after + node.nextSibling.nodeValue;
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
    // apos.selectElement(node);
    var sel = rangy.getSelection();
    var nodeRange;
    var range;
    if (sel && sel.rangeCount) {
      range = sel.getRangeAt(0);
    }
    nodeRange = rangy.createRange();
    nodeRange.setStartBefore(node);
    nodeRange.setEndAfter(node);
    var before = apos.beforeMarker;
    var after = apos.afterMarker;
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
    var unionRange;
    if (range && range.intersectsRange(nodeRange)) {
      unionRange = range.union(nodeRange);
    } else {
      unionRange = nodeRange;
    }
    rangy.getSelection().setSingleRange(unionRange);
  };

  setTimeout(function() {
    self.undoPoint();
  }, 200);
};

apos.widgetEditor = function(options) {
  var self = this;
  self.editor = options.editor;
  self.timers = [];
  self.exists = false;

  // What will be in the data attributes of the widget
  self.data = {};

  // When present in the context of a rich text editor, we interrogate
  // our placeholder div in that editor to get our current attributes
  if (options.widgetId) {
    self.$widget = options.editor.$editable.find('.apos-widget[data-id="' + options.widgetId + '"]');
    self.data = apos.cleanWidgetData(self.$widget.data());
  }

  // When displayed as a singleton or an area that does not involve a
  // rich text editor as the larger context for all widgets, our data is passed in
  if (options.data) {
    self.data = options.data;
  }

  self.data.type = self.type;

  if (self.data.id) {
    self.exists = true;
  }

  if (!self.data.id) {
    self.data.id = apos.generateId();
  }

  // Careful, relevant only when we are in a rich text editor context
  if (self.editor) {
    // Make sure the selection we return to 
    // is actually on the editor
    self.editor.$editable.focus();
  }

  // Use apos.modalFromTemplate to manage our lifecycle as a modal

  apos.log('options are:');
  apos.log(options);
  self.$el = apos.modalFromTemplate(options.template, {
    init: function(callback) {
      self.$previewContainer = self.$el.find('.apos-widget-preview-container');
      if (self.afterCreatingEl) {
        self.afterCreatingEl();
      }
      self.$el.find('[data-preview]').click(function() {
        self.preview();
        return false;
      });

      self.preview();
      return callback(null);
    },

    save: function(callback) {
      self.preSave(function() {
        if (!self.exists) {
          alert(options.messages.missing);
          return callback('error');
        }
        if (self.editor) {
          self.editor.undoPoint();
          var _new = false;
          if (!self.$widget) {
            self.createWidget();
            _new = true;
          }
        }
        self.updateWidget(function(err) {
          if (_new) {
            self.insertWidget();
            // apos.hint('What are the arrows for?', "<p>They are there to show you where to add other content before and after your rich content.</p><p>Always type text before or after the arrows, never between them.</p><p>This is especially helpful when you are floating content next to text.</p><p>You can click your rich content to select it along with its arrows, then cut, copy or paste as usual.</p><p>Don\'t worry, the arrows automatically disappear when you save your work.</p>");
          }
          // Widget backups are probably a bad idea since they would defeat
          // copy and paste between pages or at least sites
          // self.editor.updateWidgetBackup(self.widgetId, self.$widget);

          if (options.save) {
            // Used to implement save for singletons and non-rich-text-based areas.
            // Note that in this case options.data was passed in by reference, 
            // so the end result can be read there. Pay attention to the callback so
            // we can allow the user a second chance 
            options.save(function(err) {
              return callback(err);
            });
          } else {
            return callback(null);
          }
        });
      });
    },

    afterHide: function(callback) {
      self.afterHide();
      return callback(null);
    }
  });

  // Default methods

  _.defaults(self, {
    afterHide: function() {
      _.map(self.timers, function(timer) { clearInterval(timer); });
    },

    // Create a new widget for insertion into the main content editor.
    // See also the server-side itemNormalView.html template, which
    // does the same thing
    createWidget: function() {
      if (!self.editor) {
        return;
      }
      self.$widget = $('<div></div>');
      // self.$widget.attr('unselectable', 'on');
      self.$widget.addClass('apos-widget');
      self.$widget.addClass('apos-' + self.type);
      self.$widget.attr('data-type', self.type);
    },

    // Update the widget placeholder in the main content editor, then ask the server 
    // to render the widget placeholder. We *don't* call the widget player inside 
    // the main content editor because those are not restricted to content that 
    // behaves inside contentEditable.

    updateWidget: function(callback) {
      if (!self.editor) {
        return callback(null);
      }
      // When we update the widget placeholder we also clear its
      // markup and call populateWidget to insert the latest 
      self.$widget.html('');
      self.editor.addButtonsToWidget(self.$widget);
      self.updateWidgetData();
      self.renderWidget(callback);
    },

    // Widgets now just update self.data as needed so this doesn't
    // need to be overridden typically
    updateWidgetData: function() {
      if (!self.editor) {
        return;
      }
      _.each(self.data, function(val, key) {
        // Watch out for unserializable stuff
        if (key === 'uiResizable') {
          return;
        }
        self.$widget.attr('data-' + key, apos.jsonAttribute(val));
      });
    },

    // Ask the server to render the widget's contents, stuff them into the placeholder
    renderWidget: function(callback) {
      if (!self.editor) {
        return callback(null);
      }
      // Get all the data attributes
      var info = apos.cleanWidgetData(self.$widget.data());
      apos.log('rendering these attributes:');
      apos.log(info);

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
      $.post('/apos/render-widget?bodyOnly=1&editView=1', info, function(html) {
        self.$widget.append(html);
        callback(null);
      });
    },

    // Insert new widget into the main content editor
    insertWidget: function() {
      if (!self.editor) {
        return;
      }

      // Newly created widgets need default position and size
      self.$widget.attr('data-position', 'middle');
      self.$widget.attr('data-size', 'full');
      self.$widget.addClass('apos-middle');
      self.$widget.addClass('apos-full');

      var markup = '';

      // Work around serious widget selection bugs in Chrome by introducing
      // characters before and after the widget that become part of selecting it
      var before = apos.beforeMarker;
      var after = apos.afterMarker;

      markup = before;

      var widgetWrapper = $('<div></div>').append(self.$widget);
      markup += widgetWrapper.html();

      markup += after;

      // markup = markup + String.fromCharCode(8288);

      // Restore the selection to insert the markup into it
      apos.popSelection();
      // Not we can insert the markup
      apos.insertHtmlAtCursor(markup);
      // Push the selection again, leaving it up to modal('hide')
      // to do the final restore
      apos.pushSelection();
    },

    preview: function() {

      function go() {
        self.$previewContainer.find('.apos-widget-preview').remove();
        if (self.exists) {
          // Ask the server to generate a nice preview of the widget's contents
          // for us, via its normal view renderer. This avoids code duplication
          // and an inevitable drift into different behavior between browser
          // and server. At some point perhaps we'll run the same rendering code
          // on both client and server... if it matters, Node is terribly fast
          var info = {};
          _.defaults(info, self.data);
          // Comes in from self.data and breaks serialization ):
          delete info['uiResizable'];
          info.type = self.type;
          info.size = 'full';
          info.position = 'center';
          if (self.getContent) {
            info.content = self.getContent();
          } else {
            info.content = undefined;
          }
          $.post('/apos/render-widget', info, function(html) {
            // jQuery 1.9+ is super fussy about constructing elements from html
            // more explicitly
            var previewWidget = $($.parseHTML(html));
            previewWidget.addClass('apos-widget-preview');
            self.$previewContainer.prepend(previewWidget);
            self.$el.find('.apos-requires-preview').show();
            if (apos.widgetPlayers[self.type]) {
              apos.widgetPlayers[self.type](previewWidget);
            }
          });
        }
        else
        {
          self.$el.find('.apos-requires-preview').hide();
        }
      }

      if (self.prePreview) {
        self.prePreview(go);
      } else {
        go();
      }
    },

    // Override if you need to carry out an action such
    // as fetching video information before the save can 
    // take place. Takes a callback which completes the
    // save operation, or gracefully refuses it if you
    // don't set self.exists to true. Use of a callback
    // allows you to asynchronously fetch video information, etc.
    preSave: function(callback) {
      callback();
    }
  });
};

apos.widgetTypes = {};

apos.widgetTypes.slideshow = {
  label: 'Slideshow',

  editor: function(options) {
    var self = this;
    var $items;

    if (!options.messages) {
      options.messages = {};
    }
    if (!options.messages.missing) {
      options.messages.missing = 'Upload an image file first.';
    }

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

      self.$el.find('[data-uploader]').fileupload({
        dataType: 'json',
        // This is nice in a multiuser scenario, it prevents slamming,
        // but I need to figure out why it's necessary to avoid issues
        // with node-imagemagick 
        sequentialUploads: true,
        start: function (e) {
          $('[data-progress]').show();
          $('[data-finished]').hide();
        },
        stop: function (e) {
          $('[data-progress]').hide();
          $('[data-finished]').show();
        },
        progressall: function (e, data) {
          var progress = parseInt(data.loaded / data.total * 100, 10);
          self.$el.find('[data-progress-percentage]').text(progress);
        },
        done: function (e, data) {
          if (data.result.files) {
            _.each(data.result.files, function (file) {
              addItem(file);
            });
            reflect();
            self.preview();
          }
        }
      });
    };

    // The server will render an actual slideshow, but we also want to see
    // thumbnails of everything with draggability for reordering and remove buttons
    self.prePreview = function(callback) {
      apos.log('self.data in prePreview');
      apos.log(self.data);
      $items.find('[data-item]:not(.apos-template)').remove();
      var items = self.data.items;
      if (!items) {
        items = [];
      }
      _.each(items, function(item) {
        addItem(item);
      });
      callback();
    };

    function addItem(item) {
      var $item = apos.fromTemplate($items.find('[data-item]'));
      $item.find('[data-image]').attr('src', apos.uploadsUrl + '/files/' + item._id + '-' + item.name + '.one-third.' + item.extension);
      $item.data('item', item);
      $item.click('[data-remove]', function() {
        $item.remove();
        reflect();
        self.preview();
        return false;
      });
      $items.append($item);
    }

    // Update the data attributes to match what is found in the 
    // list of items. This is called after remove and reorder events
    function reflect() {
      var $itemElements = $items.find('[data-item]:not(.apos-template)');

      self.data.items = [];

      $.each($itemElements, function(i, item) {
        var $item = $(item);
        self.data.items.push($item.data('item'));
      });
      // An empty slideshow is allowed, so permit it to be saved
      // even if nothing has been added
      self.exists = true;
    }

    self.type = 'slideshow';
    options.template = '.apos-slideshow-editor';

    // Parent class constructor shared by all widget editors
    apos.widgetEditor.call(self, options);
  }
};

apos.widgetTypes.video = {
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
    };

    function getVideoInfo(callback) {
      var url = self.$embed.val();
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

    self.preSave = getVideoInfo;

    self.prePreview = getVideoInfo;

    self.type = 'video';
    options.template = '.apos-video-editor';

    // Parent class constructor shared by all widget editors
    apos.widgetEditor.call(self, options);
  }
};

apos.widgetTypes.pullquote = {
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
        self.pullquote = self.$widget.find('.apos-pullquote-text').text();
      }
      self.$pullquote = self.$el.find('.apos-embed');
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
    };

    self.type = 'pullquote';
    options.template = '.apos-pullquote-editor';

    // Parent class constructor shared by all widget editors
    apos.widgetEditor.call(self, options);
  },

  getContent: function($el) {
    return $el.find('.apos-pullquote-text').text();
  }
};

apos.widgetTypes.code = {
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
      self.$code = self.$el.find('.apos-code');
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
    };

    self.type = 'code';
    options.template = '.apos-code-editor';

    // Parent class constructor shared by all widget editors
    apos.widgetEditor.call(self, options);
  },

  getContent: function($el) {
    return $el.find('pre').text();
  }
};

// Utilities

// Widget ids should be valid names for javascript variables, just in case
// we find that useful, so avoid hyphens

apos.generateId = function() {
  return 'w' + Math.floor(Math.random() * 1000000000) + Math.floor(Math.random() * 1000000000);
};

// mustache.js solution to escaping HTML (not URLs)
apos.entityMap = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': '&quot;',
  "'": '&#39;',
  "/": '&#x2F;'
};

apos.escapeHtml = function(string) {
  return String(string).replace(/[&<>"'\/]/g, function (s) {
    return apos.entityMap[s];
  });
};

// http://stackoverflow.com/questions/2937975/contenteditable-text-editor-and-cursor-position

apos.insertHtmlAtCursor = function(html) {
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

apos.deselect = function() {
  rangy.getSelection().removeAllRanges();
};

apos.selectElement = function(el) {
  var range = rangy.createRange();
  range.setStartBefore(el);
  range.setEndAfter(el);
  var sel = rangy.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
};

// Move the caret to the specified offset in characters
// within the specified element. 
apos.moveCaretToTextPosition = function(el, offset) {
  var range = rangy.createRange();
  range.setStart(el, offset);
  range.setEnd(el, offset);
  var sel = rangy.getSelection();
  sel.setSingleRange(range);
};

apos.moveCaretToEnd = function() {
  var last = apos.$editable.contents().find(':last');
  if (last.length) {
    apos.moveCaretToTextPosition(last[0], last.text().length);
  }
};

apos.enableAreas = function() {
  $('body').on('click', '.apos-edit-area', function() {

    var area = $(this).closest('.apos-area');
    var slug = area.attr('data-slug');

    $.get('/apos/edit-area', { slug: slug, controls: area.attr('data-controls') }, function(data) {
      area.find('.apos-edit-view').remove();
      var editView = $('<div class="apos-edit-view"></div>');
      editView.append(data);
      area.append(editView);
      area.find('.apos-normal-view').hide();

      area.find('[data-cancel-area]').click(function() {
        destroyEditorAndShowNormalView();
        return false;
      });

      area.find('[data-save-area]').click(function() {
        var slug = area.attr('data-slug');
        $.post('/apos/edit-area',
          {
            slug: slug,
            content: apos.stringifyArea(area.find('[data-editable]'))
          }, function(data) {
            area.find('.apos-content').html(data);
            destroyEditorAndShowNormalView();
            apos.enablePlayers(area);
          }
        );
        return false;
      });

      function destroyEditorAndShowNormalView() {
        var $editor = area.find('.apos-editor');
        $editor.data('apos-editor').destroy();
        area.find('.apos-edit-view').remove();
        area.find('.apos-normal-view').show();
      }
    });
    return false;
  });

  $('body').on('click', '.apos-edit-singleton', function() {
    var $singleton = $(this).closest('.apos-singleton');
    var slug = $singleton.attr('data-slug');
    var type = $singleton.attr('data-type');

    var itemData = { position: 'middle', size: 'full' };
    var $item = $singleton.find('.apos-content .apos-widget :first');
    if ($item.length) {
      itemData = apos.cleanWidgetData($item.data());
    }
    new apos.widgetTypes[type].editor({
      data: itemData,
      save: function(callback) {
        $.post('/apos/edit-singleton',
          {
            slug: slug,
            // By now itemData has been updated (we passed it
            // into the widget and JavaScript passes objects by reference)
            content: JSON.stringify(itemData)
          },
          function(markup) {
            $singleton.find('.apos-content').html(markup);
            apos.enablePlayers($singleton);
            callback(null);
          }
        ).fail(function() {
          alert('Server error, please try again.');
          callback('error');
        });
      }
    });
    return false;
  });
};

apos.parseArea = function(content) {
  // Helper functions

  function flushRichText() {
    if (richText.length) {
      items.push({ type: 'richText', content: richText });
      richText = '';
    }
  }

  var node = document.createElement('div');
  node.innerHTML = content;
  var children = node.childNodes;
  var items = [];
  var richText = '';
  for (var i = 0; (i < children.length); i++) {
    var child = node.childNodes[i];
    if (child.nodeType === 3) {
      // This is a text node. Take care to escape when appending it to the rich text
      richText += apos.escapeHtml(child.nodeValue);

    } else if (child.nodeType === 1) {
      if (child.getAttribute('data-type')) {
        // This is a widget, it gets its own entry in items
        flushRichText();

        var type = child.getAttribute('data-type');
        var item = {};
        if (apos.widgetTypes[type].getContent) {
          item.content = apos.widgetTypes[type].getContent($(child));
        }

        var data = apos.cleanWidgetData($(child).data());
        _.extend(item, data);
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
};

apos._modalStack = [];

apos._modalInitialized = false;

// We have a stack of modals going, we want to add a blackout to the
// previous one, or the body if this is the first modal
apos.getTopModalOrBody = function() {
  return $(apos._modalStack.length ? apos._modalStack[apos._modalStack.length - 1] : 'body');
};

// Be sure to read about apos.modalFromTemplate too, as that is usually
// the easiest way to present a modal.

// apos.modal displays the element specified by sel as a modal dialog. Goes 
// away when the user clicks .apos-save or .apos-cancel, or submits the form
// element in the modal (implicitly saving), or presses escape.

// options.init can be an async function to populate the
// modal with content (usually used with apos.modalFromTemplate, below).
// If you pass an error as the first argument to the callback the
// modal will not appear and options.afterHide will be triggered immediately.
// Don't forget to call the callback. 
//
// Note that apos.modal is guaranteed to return *before* options.init is called, 
// so you can refer to $el in a closure. This is useful if you are using
// apos.modalFromTemplate to create $el.

// options.afterHide can be an asynchronous function to do something
// after the modal is dismissed (for any reason, whether saved or cancelled), 
// like removing it from the DOM if that is appropriate.
// Don't forget to call the callback. Currently passing an error
// to the afterHide callback has no effect.

// options.save can be an asynchronous function to do something after
// .apos-save is clicked (or enter is pressed in the only text field).
// It is invoked before afterHide. If you pass an error to the callback,
// the modal is NOT dismissed, allowing you to do validation. If it does
// not exist then the save button has no hardwired function (and need not be present).

// If you wish to dismiss the dialog for any other reason, just trigger
// an event on the modal dialog element:

// $el.trigger('aposModalHide')

// Focus is automatically given to the first visible form element
// that does not have the apos-filter class.

// Modals may be nested and the right thing will happen.

apos.modal = function(sel, options) {

  if (!apos._modalInitialized) {
    apos._modalInitialized = true;
    // Just ONE event handler for the escape key so we don't have
    // modals falling all over themselves to hide each other
    // consecutively.

    // Escape key should dismiss the top modal, if any

    $(document).on('keyup.aposModal', function(e) {
      if (e.keyCode === 27) {
        var topModal = apos.getTopModalOrBody();
        if (topModal.filter('.apos-modal')) {
          topModal.trigger('aposModalHide');
          return false;
        } else {
          return true;
        }
      }
      return true;
    });
  }

  var $el = $(sel);

  if (!options) {
    options = {};
  }

  _.defaults(options, {
    init: function(callback) {callback(null);},
    save: function(callback) {callback(null);},
    afterHide: function(callback) {callback(null);}
  });

  $el.on('aposModalHide', function() {
    // TODO consider what to do if this modal is not the top.
    // It's tricky because some need to be removed rather than
    // merely hid. However we don't currently dismiss modals other
    // than the top, so...
    apos._modalStack.pop();
    var blackoutContext = apos.getTopModalOrBody();
    blackoutContext.find('.apos-modal-blackout').remove();
    $el.hide();
    apos.popSelection();
    options.afterHide(function(err) {
      return;
    });
  });

  function hideModal() {
    $el.trigger('aposModalHide');
    return false;
  }

  // Enter key driven submits of the form should act like a click on the save button,
  // do not try to submit the form old-school
  $el.on('submit', 'form', function() {
    $el.find('.apos-save').click();
    return false;
  });

  $el.on('click', '.apos-cancel', hideModal);

  $el.on('click', '.apos-save', function() {
    options.save(function(err) {
      if(!err) {
        hideModal();
      }
    });
    return false;
  });

  apos.afterYield(function() {
    options.init(function(err) {
      if (err) {
        hideModal();
        return;
      }
      apos.pushSelection();
      var blackoutContext = apos.getTopModalOrBody();
      var blackout = $('<div class="apos-modal-blackout"></div>');
      blackoutContext.append(blackout);
      apos._modalStack.push($el);
      $('body').append($el);
      $el.offset({ top: $('body').scrollTop() + 100, left: ($(window).width() - $el.outerWidth()) / 2 });
      apos.log('SHOWING:');
      apos.log($el);
      $el.show();
      // Give the focus to the first form element. (Would be nice to
      // respect tabindex if it's present, but it's rare that
      // anybody bothers)
      $el.find("form:not(.apos-filter) :input:visible:enabled:first").focus();
    });
  });

  return $el;
};

// Clone the element matching the specified selector that
// also has the apos-template class, remove the apos-template
// class from the clone, and present it as a modal. This is a
// highly convenient way to present modals based on templates
// present in the DOM (note that the .apos-template class hides
// things until they are cloned). Accepts the same options as
// apos.modal, above. Returns a jquery object referring
// to the modal dialog element. Note that this method always
// returns *before* the init method is invoked.

apos.modalFromTemplate = function(sel, options) {

  var $el = apos.fromTemplate(sel);
  apos.log("Length of sel: " + $el.length);
  apos.log("sel is: " + sel);

  // Make sure they can provide their own afterHide
  // option, and that we don't remove $el until
  // after it invokes its callback

  var afterAfterHide = options.afterHide;
  if (!afterAfterHide) {
    afterAfterHide = function(callback) {
      return callback(null);
    };
  }
  options.afterHide = function(callback) {
    afterAfterHide(function(err) {
      $el.remove();
      return callback(err);
    });
  };

  return apos.modal($el, options);
};

// Do something after control returns to the browser (after you return from
// whatever event handler you're in). In old browsers the setTimeout(fn, 0)
// technique is used. In the latest browsers setImmediate is used, because
// it's faster (although it has a confusing name)

apos.afterYield = function(fn) {
  if (window.setImmediate) {
    return window.setImmediate(fn);
  } else {
    return setTimeout(fn, 0);
  }
};

// We use this to save the selection before starting
// a modal and later restore it

apos.selections = [];

apos.pushSelection = function() {
  var sel = rangy.getSelection();
  if (sel && sel.getRangeAt && sel.rangeCount) {
    var range = rangy.getSelection().getRangeAt(0);
    apos.selections.push(range);
  }
  else
  {
    apos.selections.push(null);
  }
};

apos.popSelection = function() {
  var range = apos.selections.pop();
  if (range) {
    var sel = rangy.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }
};

// The best marker to use as a workaround for webkit selection bugs
// is an invisible one (the Unicode word joiner character).
apos.beforeMarker = String.fromCharCode(8288); // '↢';
apos.afterMarker = String.fromCharCode(8288); // '↣';

(function() {
  /* jshint devel: true */
  apos.log = function(msg) {
    if (console && apos.log) {
      console.log(msg);
    }
  };
})();

// Note: you'll need to use xregexp instead if you need non-Latin character
// support in slugs. KEEP IN SYNC WITH SERVER SIDE IMPLEMENTATION in apostrophe.js
apos.slugify = function(s, options) {

  // By default everything not a letter or number becomes a dash.
  // You can add additional allowed characters via options.allow

  if (!options) {
    options = {};
  }

  if (!options.allow) {
    options.allow = '';
  }

  var r = "[^A-Za-z0-9" + apos.regExpQuote(options.allow) + "]";
  var regex = new RegExp(r, 'g');
  s = s.replace(regex, '-');
  // Consecutive dashes become one dash
  s = s.replace(/\-+/g, '-');
  // Leading dashes go away
  s = s.replace(/^\-/, '');
  // Trailing dashes go away
  s = s.replace(/\-$/, '');
  // If the string is empty, supply something so that routes still match
  if (!s.length)
  {
    s = 'none';
  }
  return s.toLowerCase();
};

// Borrowed from the regexp-quote module for node
apos.regExpQuote = function (string) {
  return string.replace(/[-\\^$*+?.()|[\]{}]/g, "\\$&");
};

// For use when storing DOM attributes meant to be compatible
// with jQuery's built-in support for JSON parsing of
// objects and arrays in data attributes. We'll be passing
// the result to .attr, so we don't have to worry about
// HTML escaping.

apos.jsonAttribute = function(value) {
  if (typeof(value) === 'object') {
    return JSON.stringify(value);
  } else {
    return value;
  }
};

apos.cleanWidgetData = function(data) {
  // Take widget data and remove attributes not meant for serialization
  delete data['uiResizable'];
  return data;
};

// Clone the element matching the selector which also has the
// .apos-template class, remove that class from the clone, and
// return the clone. This is convenient for turning invisible templates in
// the DOM into elements ready to add to the DOM.

apos.fromTemplate = function(sel) {
  var $item = $(sel).filter('.apos-template').clone();
  $item.removeClass('apos-template');
  return $item;
};

// We often submit the content of an area as part of a regular POST. This is
// a good way to pack it up
apos.stringifyArea = function($editable) {
  return JSON.stringify(apos.parseArea($editable.html()));
};

// Reusable utility to watch one jquery element's value and use it to
// suggest valid slugs by updating the second jquery element's value.
// If the initial slug contains slashes, only the last component
// (after the last slash) is changed on title edits. If the original
// slug (or its last component) is not in sync with the title, it is
// assumed that the user already made deliberate changes to the slug, and
// the slug is not automatically updated.

apos.suggestSlugOnTitleEdits = function($title, $slug) {
  // Watch the title for changes, update the slug - but only if
  // the slug was in sync with the title to start with

  var originalTitle = $title.val();
  var currentSlug = $slug.val();
  var components = currentSlug.split('/');
  var currentSlugTitle = components.pop();
  apos.log('testing slug');
  if (currentSlugTitle === apos.slugify(originalTitle)) {
    apos.log('slug initially compatible with title');
    $title.on('keyup', function() {
      var title = $title.val();
      if (title !== originalTitle) {
        var currentSlug = $slug.val();
        var components = currentSlug.split('/');
        if (components.length) {
          components.pop();
          var candidateSlugTitle = apos.slugify(title);
          components.push(candidateSlugTitle);
          var newSlug = components.join('/');
          $slug.val(newSlug);
        }
      }
    });
  }
};

// Accept tags as a comma-separated string and sanitize them,
// returning an array of zero or more nonempty strings
apos.tagsToArray = function(tags) {
  if (typeof(tags) === 'number') {
    tags += '';
  }
  if (typeof(tags) !== 'string') {
    return [];
  }
  tags += '';
  tags = tags.split(/,\s*/);
  // split returns an array of one empty string for an empty source string ):
  tags = _.filter(tags, function(tag) { return tag.length > 0; });
  // Make them all strings
  tags = _.map(tags, function(tag) {
    return tag + '';
  });
  return tags;
};

// Convert tags back to a string
apos.tagsToString = function(s) {
  if (!$.isArray(s)) {
    // This is legit if no tags property exists yet on an object, don't bomb
    return '';
  }
  var result = s.join(', ');
  apos.log("Tags string is " + result);
  return result;
};

// Convert camel case to a hyphenated css name. Not especially fast,
// hopefully you only do this during initialization and remember the result
apos.cssName = function(camel) {
  var i;
  var css = '';
  for (i = 0; (i < camel.length); i++) {
    var c = camel.charAt(i);
    if (c === c.toUpperCase()) {
      css += '-';
      css += c.toLowerCase();
    } else {
      css += c;
    }
  }
  return css;
};

// RADIO BUTTON CONVENIENCE FUNCTIONS

// Anywhere you have a form and want to manipulate it with jQuery,
// these will get you past the nonsense of val() not working
// because there is more than one element involved. Just select
// all the radio buttons by name and pass to these.

apos.setRadio = function($els, value) {
  $.each($els, function() {
    $(this).attr('checked', $(this).attr('value') === value);
  });
};

apos.getRadio = function($els) {
  return $els.filter(':checked').val();
};

