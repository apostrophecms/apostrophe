/* global rangy, $, _ */
/* global alert, prompt */

if (!window.apos) {
  window.apos = {};
}

$( document ).tooltip({
  show: { effect: "fadeIn", duration: 200 },
  hide: { effect: "fadeOut", duration: 200 },
  position: { my: "left top+10", at: "left bottom" }
});

var apos = window.apos;

// Constructing the editor is a two step process:
// 1. var editor = new apos.Editor(options);
// 2. editor.init()
// This makes it significantly easier to override methods when subclassing
// the editor.

apos.Editor = function(options) {
  var self = this;
  var styleMenu;
  var styleBlockElements;
  var resizing = false;

  var areaOptions = options.options || {};

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

  // Enable the function of a control in the editing menu. `command` is
  // a unique string identifying the command and also set as a data
  // attribute on the button in question. `options.keys` is an array of
  // keyboard combinations that fire this action (see jquery-hotkeys for
  // the syntax). If `options.promptForLabel` is present, the text of
  // that option is displayed as a prompt, and the user's response is
  // passed as the third argument to document.execCommand().
  //
  // If `options.callback` is present, it is called, otherwise
  // `document.execCommand()` is called with the command.

  self.enableControl = function(command, options) {
    if (typeof(options) !== 'object') {
      // bc
      options = {};
      options.keys = arguments[1];
      options.promptForLabel = arguments[2];
    }
    function doCommand() {
      var arg = null;
      self.undoPoint();

      if (options.promptForLabel) {
        arg = prompt(options.promptForLabel);
        if (!arg) {
          return false;
        }
      }

      if (options.callback) {
        self.$editable.focus();
        options.callback();
      } else {
        document.execCommand(command, false, arg);
        self.$editable.focus();
      }

      return false;
    }

    self.$el.find('[data-' + command + ']').click(doCommand).mousedown(function(e) {
      // Must prevent default on mousedown or the rich text editor
      // loses the focus
      e.preventDefault();
      return false;
    });

    if (options.keys) {
      _.each(options.keys, function(key) {
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

  };

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

  // BEGIN TABLE EDITING

  self.insertTable = function() {
    var markup = '';
    var $rows, $columns;
    var $tableModal = apos.modalFromTemplate('.apos-table-editor', {
      init: function(callback) {
        $rows = $tableModal.findByName('rows');
        $rows.val(3);
        $columns = $tableModal.findByName('columns');
        $columns.val(2);
        return callback(null);
      },
      save: function(callback) {
        markup = '<table>';
        var row, col;
        var rows = $rows.val();
        var columns = $columns.val();

        for (row = 0; (row < rows); row++) {
          markup += '<tr>';
          for (col = 0; (col < columns); col++) {
            markup += '<td></td>';
          }
          markup += '</tr>';
        }
        markup += '</table>';

        // We need an HTML string for the insertion, but we can still
        // use our jquery-bsed method to decorate the new table with controls
        // so we don't have competing implementations of that
        var $markup = $(markup);
        self.addTableControls($markup);
        markup = $markup.getOuterHTML();
        return callback(null);
      },
      afterHide: function(callback) {
        apos.insertHtmlAtCursor(markup);
        return callback(null);
      }
    });
  };

  self.enableMenu = function(name, action) {
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

      if ((navigator.product === 'Gecko') && (action === 'formatBlock')) {
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
  };

  self.dropTableControls = function($table) {
    $table.find('[data-control-row]').remove();
    // all th elements are controls
    $table.find('th').remove();
  };

  self.addTableControls = function($table) {
    var columns = self.countTableColumns($table);

    // First the control columns: remove buttons for rows, and an add
    // button for a new row
    var $rows = $table.find('tr');

    $.each($rows, function(i, row) {
      var $row = $(row);
      $row.prepend($('<th class="apos-table-button"><a href="#" title="Remove Row" data-remove-row>-</a></th>'));
      $row.append($('<th></th>'));
    });

    // Now the top control row: remove buttons for columns, and
    // an add button for a new column
    var column;
    var markup = '<tr data-control-row><th data-corner></th>';
    // "Remove" buttons for columns
    for (column = 0; (column < columns); column++) {
      markup += '<th class="apos-table-button"><a href="#" title="Remove Column" data-remove-column>-</a></th>';
    }
    markup += '<th class="apos-table-button"><a href="#" title="Add Column" data-add-column>+</a></th>';
    markup += '</tr>';
    $table.prepend($(markup));

    // last the bottom control row: an add button for a new row
    $table.append($('<tr data-control-row><th colspan="1000" class="apos-table-button"><a href="#" title="Add Row" data-add-row>+</a></th></tr>'));
  };

  self.countTableColumns = function($table) {
    var $rows = $table.find('tr');
    var max = 0;
    $.each($rows, function(i, row) {
      var $row = $(row);
      var cols = $row.find('td').length;
      if (cols > max) {
        max = cols;
      }
    });
    return max;
  };

  // END TABLE EDITING

  self.editLink = function() {
    var sel, range, $startContainer, $a;
    var $href;
    var $target;
    var $name;
    var href, target, name;
    var $el = apos.modalFromTemplate('.apos-link-editor', {
      init: function(callback) {
        $a = updateRange();
        $href = $el.findByName('href');
        $target = $el.findByName('target');
        $name = $el.findByName('name');
        if ($a.length) {
          href = $a.attr('href');
          target = $a.attr('target');
          name = $a.attr('name');
          $href.val(href);
          $target.val(target);
          $name.val(name);
        }
        return callback(null);
      },
      save: function(callback) {
        if (!$a.length) {
          $a = $('<a></a>');
          try {
            apos.popSelection();
            updateRange();
            range.surroundContents($a[0]);
            apos.pushSelection();
          } catch (e) {
            // Rangy won't surround 'foo<b>something' (note the </b> is not
            // in the range). We could eventually address this by splitting
            // into two links automatically
            apos.log(e);
          }
        }

        href = $href.val().trim();
        target = $target.val().trim();
        name = $name.val().trim();

        if (!href.length) {
          alert('You must specify a link, a name, or both.');
          return callback('invalid');
        }

        href = apos.fixUrl(href);
        if (!href) {
          alert('That link is not valid. Examples of valid links: /my/page, http://google.com/, mailto:tom@example.com');
          return callback('invalid');
        }

        if (href) {
          $a.attr('href', href);
        } else {
          $a.removeAttr('href');
        }
        if (target.length) {
          $a.attr('target', target);
        } else {
          $a.removeAttr('target');
        }
        if (name.length) {
          $a.attr('name', name);
        } else {
          $a.removeAttr('name');
        }
        return callback(null);
      },
      afterHide: function(callback) {
        return callback(null);
      }
    });
    function updateRange() {
      sel = rangy.getSelection();
      range = sel.getRangeAt(0);
      $startContainer = $(range.startContainer);
      return $startContainer.closest('a');
    }
  };

  self.enableControls = function() {
    self.enableControl('bold', { keys: ['meta+b', 'ctrl+b'] });
    self.enableControl('italic', { keys: ['meta+i', 'ctrl+i'] });
    self.enableControl('createLink', { keys: ['meta+l', 'ctrl+l'], callback: self.editLink });
    self.enableControl('unlink', { keys: ['meta+l', 'ctrl+l'] });
    self.enableControl('insertUnorderedList', { keys: [] });
    self.enableControl('insertTable', { keys: [], callback: self.insertTable });
    self.enableMenu('style', 'formatBlock');
  };

  self.init = function() {
    self.$el = $(options.selector);
    // The contenteditable element inside the wrapper div
    self.$editable = self.$el.find('[data-editable]');

    // We stop these when the editor is destroyed
    self.timers = [];

    self.undoQueue = [];
    self.redoQueue = [];

    self.$editable.on('click', '[data-add-column]', function(event) {
      self.undoPoint();
      var $table = $(this).closest('table');
      self.dropTableControls($table);
      var $rows = $table.find('tr');
      $.each($rows, function(i, row) {
        var $row = $(row);
        // Ignore the control rows
        if ($row.find('th').length) {
          return;
        }
        $row.append('<td></td>');
      });
      self.addTableControls($table);
      return false;
    });

    self.$editable.on('click', '[data-remove-column]', function(event) {
      self.undoPoint();
      // Tables are structured by row, not by column, so this is a little tedious
      // 1. Figure out what column we're in (0, 1, 2...)
      var $th = $(this).closest('th');
      var column = 0;
      while ($th.prev().length) {
        $th = $th.prev();
        column++;
      }
      // For each row, remove the cell in the appropriate column, if any
      var $trs = $(this).closest('table').find('tr');
      $.each($trs, function(i, tr) {
        var $tr = $(tr);
        var $cells = $tr.find('th,td');
        if ($cells.length > column) {
          $($cells[column]).remove();
        }
      });
      return false;
    });

    self.$editable.on('click', '[data-remove-row]', function(event) {
      self.undoPoint();
      var $tr = $(this).closest('tr');
      $tr.remove();
      return false;
    });

    self.$editable.on('click', '[data-add-row]', function(event) {
      self.undoPoint();
      var $table = $(this).closest('table');
      self.dropTableControls($table);
      var columns = self.countTableColumns($table);
      var $row = $('<tr></tr>');
      var i;
      for (i = 0; (i < columns); i++) {
        $row.append('<td></td>');
      }
      $table.append($row);
      self.addTableControls($table);
      return false;
    });

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
    self.$editable.find('table').each(function(i, table) {
      self.addTableControls($(this));
    });
    var $widgets = self.$editable.find('.apos-widget');
    $widgets.each(function() {
      var $widget = $(this);

      var widgetId = $widget.attr('data-id');

      // Do NOT add editing controls to widgets nested in other widgets.
      // These are part of a snippet and should be edited in that separate context.
      // Just edit the outer snippet widget.
      if ($widget.parents('.apos-widget').length) {
        return;
      }

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

    self.enableControls();

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

    self.$editable.bind('keydown', 'return', function() {
      // Don't let Chrome do bizarre things when new divs or p's are created,
      // such as trapping widgets inside divs and so forth, as E. saw repeatedly
      // on the DR site.
      //
      // The use of br elements effectively prevents this without highly questionable
      // DOM-repairing code.
      //
      // The hard part here is moving the cursor after the br rather than leaving it
      // before it so that typing behaves as the user expects.

      // Exception: don't do this if we're inside a <ul>. Let the browser
      // insert an <li> for us.

      var sel = rangy.getSelection();
      if (sel.rangeCount) {
        var range = sel.getRangeAt(0);
        var box = range.startContainer;
        while (box) {
          if (box.tagName) {
            var tag = box.tagName.toLowerCase();
            // Don't look above the editor itself in the DOM tree
            if ($(box).hasClass('apos-editable')) {
              break;
            }
            if (tag === 'ul') {
              // Default behavior is best here
              return true;
            }
          }
          box = box.parentNode;
        }
      }

      apos.insertHtmlAtCursor('<br /><span data-after-insertion></span>');
      var $afterMark = self.$editable.find('[data-after-insertion]');
      apos.selectElement($afterMark[0]);
      var saved = rangy.saveSelection();
      $afterMark.remove();
      rangy.restoreSelection(saved);
      return false;
    });

    // Firefox displays resize handles we don't want.
    // We prefer to do that via the widget editor
    if(navigator.product === 'Gecko') {
      //this is a firefox-only thing we need to keep it wrapped in this browser check so it doesn't break IE10
      document.execCommand("enableObjectResizing", false, false);
    }
    self.$editable.bind('cut paste', function() {
      self.undoPoint();
      return true;
    });

    // All buttons that launch editors derived from widgetEditor

    self.$el.find('[data-widgetButton]').click(function() {
      var widgetType = $(this).attr('data-widgetButton');
      var options = areaOptions[widgetType] || {};
      new apos.widgetTypes[widgetType].editor({ editor: self, options: options });
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
      var options = areaOptions[widgetType] || {};
      new apos.widgetTypes[widgetType].editor(
      {
        editor: self,
        widgetId: widgetId,
        options: options
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
      // ul's should be hoisted themselves but are not considered
      // grounds for hoisting something else.

      self.$editable.find('h1, h2, h3, h4, h5, h6, div, p, pre, ul').each(function() {
        var outer = $(this);
        if (outer.closest('.apos-widget').length) {
          return;
        }
        // Use first() because the first call usually resolves the rest, and if
        // we keep going with the old result set we'll wind up reversing the order
        // of the elements
        $(this).find('h1, h2, h3, h4, h5, h6, div, p, pre, ul').first().each(function() {
          var inner = $(this);
          var i;

          if (inner.parents('.apos-widget').length) {
            return;
          }

          // If we are nested in an li before we are nested in 'outer',
          // don't migrate.
          var parents = inner.parents();
          for (i = 0; (i < parents.length); i++) {
            if (parents[i] === outer[0]) {
              break;
            }
            if (parents[i].nodeName.toLowerCase() === 'li') {
              return;
            }
          }

          var saved = rangy.saveSelection();
          var next;
          var widget = false;
          if (inner.hasClass('apos-widget')) {
            // When a widget is the inner element that needs hoisting,
            // we can't make it the parent of its former successors, we
            // need to make a clone of its parent the parent of its
            // former successors
            widget = true;
            next = outer.clone();
            next.html('');
          } else {
            next = inner.clone();
          }
          // Younger siblings of inner become descendants of next
          apos.moveYoungerSiblings(inner[0], next[0]);
          // outer keeps older siblings of inner
          apos.keepOlderSiblings(inner[0]);
          // inner becomes a successor of outer, just before next, if it
          // is a widget. Otherwise it's gone baby gone, because we moved
          // everything interesting about it - cloned it to next and moved
          // its siblings
          if (widget) {
            // Pure DOM seems to do a better job around text elements
            outer[0].parentNode.insertBefore(inner[0], outer[0]);
            // inner.insertAfter(outer);
          }
          // next is now the successor of outer
          next.insertAfter(outer);
          rangy.restoreSelection(saved);
        });
      });

      // Final thing in the editable must be a br. Without this
      // it becomes impossible to get out of an h3 and type beyond it,
      // or press enter after a widget, in a number of situations in Chrome.
      // Please do not remove this.

      var $placeholder = self.$editable.find('[data-placeholder-br]');
      if (!$placeholder.length) {
        var saved = rangy.saveSelection();
        self.$editable.append($('<br data-placeholder-br />'));
        rangy.restoreSelection(saved);
      } else {
        if ($placeholder[0].nextSibling) {
          // This br is no longer at the end of the document, so let it be a
          // regular br and this code will introduce a new placeholder on the
          // next pass
          $placeholder.removeAttr('data-placeholder-br');
        }
      }

      // Cleanups per widget

      var $widgets = self.$editable.find('.apos-widget');

      $widgets.each(function() {

        // If next node after widget is a plaintext node, encase that text
        // in a div so it doesn't get hoovered into the widget and lost

        // var text = this.nextSibling;
        // if (text.nodeType === 3) {
        //   var div = document.createElement('div');
        //   text.parentNode.insertBefore(text, div);
        //   div.appendChild(text);
        // }

        var $widget = $(this);

        // Do NOT add editing controls to widgets nested in other widgets.
        // These are part of a snippet and should be edited in that separate context.
        // Just edit the outer snippet widget.
        if ($widget.parents('.apos-widget').length) {
          return;
        }

        var $container = $widget.closest('.apos-editor');
        var cellWidth = ($container.outerWidth() / 6);

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
        var saved;
        if (node.previousSibling) {
          if (node.previousSibling.nodeValue === null) {
            p = document.createTextNode(before);
            saved = rangy.saveSelection();
            $(node).before(p);
            rangy.restoreSelection(saved);
          } else {
            p = node.previousSibling.nodeValue;
            if (p.substr(p.length - 1, 1) !== before) {
              saved = rangy.saveSelection();
              node.previousSibling.nodeValue += before;
              rangy.restoreSelection(saved);
            }
          }
        }
        if (node.nextSibling) {
          if (node.nextSibling.nodeValue === null) {
            p = document.createTextNode(after);
            saved = rangy.saveSelection();
            $(node).after(p);
            rangy.restoreSelection(saved);
          } else {
            n = node.nextSibling.nodeValue;
            if (n.substr(0, 1) !== after) {
              saved = rangy.saveSelection();
              node.nextSibling.nodeValue = after + node.nextSibling.nodeValue;
              rangy.restoreSelection(saved);
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
            // Never go above the editor itself in the DOM tree
            if ($(box).hasClass('apos-editable')) {
              break;
            }
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

    setTimeout(function() {
      self.undoPoint();
    }, 200);
  };
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
    self.data = apos.getWidgetData(self.$widget);
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
      self.$widget.attr('data', apos.jsonAttribute(self.data));
      // These need to be visible separately
      self.$widget.attr('data-id', self.data.id);
      self.$widget.attr('data-type', self.data.type);
    },

    // Ask the server to render the widget's contents, stuff them into the placeholder
    renderWidget: function(callback) {
      if (!self.editor) {
        return callback(null);
      }
      var info = apos.getWidgetData(self.$widget);

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
      info._options = options.options || {};
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

      // markup = markup + String.fromCharCode(65279);

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
          info._options = options.options || {};
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
    if (self.fileGroup === undefined) {
      self.fileGroup = 'images';
    }
    var showImages = (options.showImages === undefined) ? true : options.showImages;
    // Options passed from template or other context
    var templateOptions = options.options || {};
    var widgetClass = templateOptions.widgetClass;
    var aspectRatio = templateOptions.aspectRatio;
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

    // Calls to self.busy are cumulative, so we can figure out when
    // all uploads have stopped
    self._busy = 0;

    self.busy = function(state) {
      apos.busy(self.$el, state);
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

      var $uploader = self.$el.find('[data-uploader]');
      $uploader.fileupload({
        dataType: 'json',
        dropZone: self.$el.find('.apos-modal-body'),
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
      self.$el.find('.apos-modal-body').bind('dragover', function (e) {
          var dropZone = self.$el.find('.apos-modal-body'),
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
      // if template wants a forced orientation on a slideshow
      if (orientation.active){
        self.$el.find('.apos-modal-body').addClass('apos-select-orientation');

        // find out if it has a previously saved orientation, activate it
        if (typeof(self.data.orientation) !== 'undefined' && self.data.orientation !== ''){
          self.$el.find('[data-orientation-button="'+self.data.orientation+'"]').addClass('active').attr('data-orientation-active', '');
        }
        // find out if it has an explicit default set, activate it
        else if (orientation.defaultOption){
          self.$el.find('[data-orientation-button="'+orientation.defaultOption+'"]').addClass('active').attr('data-orientation-active', '');
          self.data.orientation = orientation.defaultOption;
        }
        // else, set to portrait
        else
        {
          self.$el.find('[data-orientation-button="portrait"]').addClass('active').attr('data-orientation-active', '');
          self.data.orientation = 'portrait';
        }
      }

      // if template passed extraFields as an object, it is trying to disable certain fields
      // it also needs to be enabled

      if (typeof(extraFields) === 'object'){
        $.each(extraFields, function(key, value) {
          self.$el.find('.apos-modal-body [data-extra-fields-'+key+']').remove();
        });
      }

      self.$el.find('[data-enable-extra-fields]').on('click', function(){
       self.$el.find('[data-items]').toggleClass('apos-extra-fields-enabled');
       reflect();
      });

      // on Edit button click, reveal extra fields
      self.$el.on('click', '[data-extra-fields-edit]', function(){
        self.$el.find('[data-item]').removeClass('apos-slideshow-reveal-extra-fields');
        var $button = $(this);
        $button.closest('[data-item]').toggleClass('apos-slideshow-reveal-extra-fields');
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

      // Select new orientation
      self.$el.on('click', '[data-orientation-button]', function(){
        self.$el.find('[data-orientation-button]').each(function(){
          $(this).removeClass('active').removeAttr('data-orientation-active');
        });
        $(this).addClass('active').attr('data-orientation-active', $(this).attr('data-orientation-button'));
        return false;
      });

      self.enableChooser = function() {
        // This is what we drag to. Easier than dragging to a ul that doesn't
        // know the height of its li's
        var $target = self.$el.find('[data-drag-container]');
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
          self.busy(true);
          $.get('/apos/browse-files', {
            skip: page * perPage,
            limit: perPage,
            group: self.fileGroup,
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
                  else{
                    addItem(file);
                    event.stopPropagation();
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

      self.enableChooser();
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
      // Perform autocrops if needed
      if (aspectRatio) {
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
          if (aspectRatio) {
            if (!item.crop) {
              if (!within(item.width / item.height, aspectRatio[0] / aspectRatio[1], 1.0)) {
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
                  reflect();
                  return self.preSave(callback);
                }).error(function() {
                  self.busy(false);
                  $autocropping.hide();
                  alert('Server error, please retry');
                  return callback('fail');
                });
              }
            }
          }
        });
        if (found) {
          // Done for now another invocation will occur after the autocrop
          return;
        }
      }

      // Save the active orientation
      if (self.data.orientation) {
        self.data.orientation = self.$el.find('[data-orientation-active]').attr('data-orientation-active');
      }
      self.data.showTitles = (self.$showTitles.val() === '1');
      self.data.showDescriptions = (self.$showDescriptions.val() === '1');
      self.data.showCredits = (self.$showCredits.val() === '1');

      return callback(null);
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

      if (_.contains(['gif', 'jpg', 'png'], item.extension)) {
        $item.find('[data-image]').attr('src', apos.data.uploadsUrl + '/files/' + item._id + '-' + item.name + '.one-third.' + item.extension);
      } else {
        $item.find('[data-image]').parent().addClass('apos-not-image');
        $item.find('[data-image]').parent().append('<span class="apos-file-name">' + item.name + '.' + item.extension + '</span>');
      }
      // $item.find('[data-image]').attr('src', apos.data.uploadsUrl + '/files/' + item._id + '-' + item.name + '.one-third.' + item.extension);

      // Some derivatives of slideshows use these, some don't. These are
      // not editable fields, they are immutable facts about the file
      $item.find('[data-extension]').text(item.extension);
      $item.find('[data-name]').text(item.name);

      $item.find('[data-hyperlink]').val(item.hyperlink);
      $item.find('[data-hyperlink-title]').val(item.hyperlinkTitle);
      if (extraFields || typeof(extraFields) === 'object') {
        $item.find('[data-remove]').after('<a class="apos-slideshow-control apos-edit" data-extra-fields-edit></a>');
      }
      $item.data('item', item);
      $item.find('[data-remove]').click(function() {
        $item.remove();
        reflect();
        self.preview();
        self.$el.find('[data-limit-reached]').hide();
        self.$el.find('[data-uploader-container]').show();
        self.$el.find('[data-drag-container]').removeClass('apos-upload-disabled');
        self.$el.find('[data-drag-message]').text('Drop Files Here');
        self.$el.find('[data-drag-container]').off('drop');
        return false;
      });

      $items.append($item);
      count++;

      if (limit && (count >= limit)) {
        self.$el.find('[data-limit]').text(limit);
        self.$el.find('[data-limit-reached]').show();
        self.$el.find('[data-uploader-container]').hide();
        self.$el.find('[data-drag-container]').addClass('apos-upload-disabled');
        self.$el.find('[data-drag-message]').text('The Upload Limit Has Been Reached');

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
      // fields that come from the file.

      self.data.ids = [];
      self.data.extras = {};
      self.data._items = [];

      $.each($itemElements, function(i, item) {
        var $item = $(item);

        var info = $item.data('item');
        self.data.ids.push(info._id);
        self.data.extras[info._id] = {
          hyperlink: $item.find('[data-hyperlink]').val(),
          hyperlinkTitle: $item.find('[data-hyperlink-title]').val()
        };
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

    if(!options.type) {
      self.type = 'slideshow';
    } else {
      self.type = options.type;
    }

    if(!options.template) {
      options.template = '.apos-slideshow-editor';
    }
    // Parent class constructor shared by all widget editors
    apos.widgetEditor.call(self, options);
  }
};

apos.widgetTypes.buttons = {
  label: 'Buttons',
  editor: function(options) {
    var self = this;
    options.template = '.apos-buttons-editor';
    options.type = 'buttons';
    options.options = options.options || {};
    options.options.extraFields = true;
    apos.widgetTypes.slideshow.editor.call(self, options);
  }
};

apos.widgetTypes.marquee = {
  label: 'Marquee',
  editor: function(options) {
    var self = this;
    options.template = '.apos-marquee-editor';
    options.type = 'marquee';
    options.options = options.options || {};
    // options.options.extraFields = true;
    apos.widgetTypes.slideshow.editor.call(self, options);
  }
};

apos.widgetTypes.files = {
  label: 'Files',
  editor: function(options) {
    var self = this;
    options.showImages = false;
    options.template = '.apos-files-editor';
    options.type = 'files';
    // We want the default for extra fields to be true rather than false for
    // this widget
    if (!options.options) {
      options.options = {};
    }
    if (options.options.extraFields === undefined) {
      options.options.extraFields = true;
    }
    // Explicitly avoid limiting to a particular type of file
    self.fileGroup = null;
    apos.widgetTypes.slideshow.editor.call(self, options);
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
          q: $search.val()
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
            // TODO: look into a good routine for CSS URL escaping
            $item.css('background-image', 'url(' + video.thumbnail + ')');
            $item.find('[data-image]').attr('src', video.thumbnail);
            $item.attr('title', video.title);
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
        self.exists = !!data;
        if (self.exists) {
          // Make sure the URL is part of the data we pass to our callback
          data.video = url;
          // The widget gets stores just the properties we really need to render.
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

apos.widgetTypes.html = {
  label: 'Raw HTML',
  editor: function(options) {
    var self = this;

    self.code = '';

    if (!options.messages) {
      options.messages = {};
    }
    if (!options.messages.missing) {
      options.messages.missing = 'Paste in some HTML code first.';
    }

    self.afterCreatingEl = function() {
      self.$code = self.$el.find('.apos-code');
      self.$code.val(self.data.code);
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

    self.preSave = getCode;

    self.prePreview = getCode;

    function getCode(callback) {
      var code = self.$code.val();
      self.data.code = code;
      if (callback) {
        callback();
      }
    }

    self.type = 'html';
    options.template = '.apos-html-editor';

    // Parent class constructor shared by all widget editors
    apos.widgetEditor.call(self, options);
  }
};

// Utilities

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
    var options = area.data('options');
    options.slug = slug;

    // TODO think about POSTing JSON directly
    $.get('/apos/edit-area', { slug: slug, options: JSON.stringify(options) }, function(data) {
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
            options: area.attr('data-options'),
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
    var $item = $singleton.find('.apos-content .apos-widget:first');
    if ($item.length) {
      itemData = apos.getWidgetData($item);
    }
    var $editor = new apos.widgetTypes[type].editor({
      data: itemData,
      save: function(callback) {
        if (slug) {
          // Has a slug, save it
          $.post('/apos/edit-singleton',
            {
              slug: slug,
              options: $singleton.attr('data-options'),
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
        } else {
          // Virtual singletons must be saved in other ways. Add it as a
          // data attribute of the singleton, and post an event
          $singleton.attr('data-item', JSON.stringify(itemData));
          $singleton.trigger('aposEdited', itemData);
          return callback();
        }
      },
      // Options passed from the template or other environment
      options: $singleton.data('options')
    });
    return false;
  });
};

apos.parseArea = function(content) {
  var items = [];

  // Helper functions

  // We build up richText as we sweep through DOM nodes that are
  // not widgets. Flush it by creating a new apostrophe item if it is
  // not empty.

  var richText = '';

  function flushRichText() {
    if (!richText.length) {
      return;
    }
    // Remove invisible markers used to ensure good behavior of
    // webkit inside contenteditable. Some browsers render these
    // as boxes (Windows Chrome) if they see them and the font is
    // a custom one that doesn't explicitly address this code point
    richText = apos.globalReplace(richText, apos.beforeMarker, '');
    richText = apos.globalReplace(richText, apos.afterMarker, '');

    // One more pass through the DOM (sorry!) to locate runs of
    // elements that are not block elements and box them in divs
    // so that styling content is much easier

    var oldBox = document.createElement('div');
    var newBox = document.createElement('div');
    oldBox.innerHTML = richText;
    var children = oldBox.childNodes;
    var child;

    var fold = [];
    function flushNewDiv() {
      var i;
      var newDiv;
      if (fold.length) {
        newDiv = document.createElement('div');
        for (i = 0; (i < fold.length); i++) {
          // Never just fold the node, always clone it, because
          // otherwise are still messing up the length of the children array
          newDiv.appendChild(fold[i].cloneNode(true));
        }
        fold = [];
        newBox.appendChild(newDiv);
      }
    }

    for (var i = 0; (i < children.length); i++) {
      child = children[i];
      if (_.contains([ 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'div', 'p', 'pre', 'table', 'ul', 'ol', 'nl' ], child.nodeName.toLowerCase()))
      {
        flushNewDiv();
        // Clone it so we don't mess with the length of "children"
        newBox.appendChild(child.cloneNode(true));
      } else {
        fold.push(child);
      }
    }
    flushNewDiv();
    items.push({ type: 'richText', content: newBox.innerHTML });
    richText = '';
  }

  // Pull it into jQuery land for a few cleanups best done there

  var changedInJquery = false;
  var $content = $($.parseHTML('<div data-apos-hoist-wrapper>' + content + '</div>'));

  // Remove table editing controls
  $content.find('table').each(function(i, table) {
    var $table = $(this);
    if ($table.closest('.apos-widget').length) {
      return;
    }
    // TODO: this duplicates the editor object's dropTableControls, which is
    // not great
    $table.find('[data-control-row]').remove();
    // all th elements are controls
    $table.find('th').remove();
    changedInJquery = true;
  });

  var $placeholder = $content.find('[data-placeholder-br]');
  if ($placeholder.length) {
    $placeholder.remove();
    changedInJquery = true;
  }

  // While we have it in jQuery, seize the opportunity to blow out any
  // ui-resizable-handles that are still in the DOM
  var $handles = $content.find('.ui-resizable-handle');
  if ($handles.length) {
    $handles.remove();
    changedInJquery = true;
  }
  var $widgets = $content.find('[data-type]');
  $widgets.each(function() {
    var $widget = $(this);
    if ($widget.parents('[data-type]').length) {
      // Ignore widgets nested in widgets, which may be present when we
      // work with reuse tools like the blog widget but are not really
      // being edited
      return;
    }
    var $parent = $widget.parent();
    if (!$parent.is('[data-apos-hoist-wrapper]')) {
      // Hoist the widget
      $widget.detach();
      $parent.before($widget);
      changedInJquery = true;
    }
  });
  if (changedInJquery) {
    content = $content.html();
  }

  // Push it into the DOM and loop over all nodes, including
  // text nodes, building apostrophe items

  var node = document.createElement('div');
  node.innerHTML = content;
  var children = node.childNodes;
  for (var i = 0; (i < children.length); i++) {
    var child = node.childNodes[i];
    if (child.nodeType === 3) {
      // This is a text node. Take care to escape when appending it
      // to the rich text
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

        var data = apos.getWidgetData($(child));
        _.extend(item, data);
        items.push(item);
      } else {
        // This is a rich text element like <strong> or <h3>.
        // We need the markup for the entire thing
        richText += $(child).getOuterHTML();
      }
    }
  }
  // Don't forget to flush any rich text that appeared after the last widget,
  // and/or if there are no widgets!
  flushRichText();
  return items;
};

// The best marker to use as a workaround for webkit selection bugs
// is an invisible one (the ZERO WIDTH NO-BREAK SPACE character).
// We tried using 8288 (the WORD JOINER character), but it shows as
// a box in Windows Chrome regardless of font. -Tom

apos.beforeMarker = String.fromCharCode(65279); // was '↢';
apos.afterMarker = String.fromCharCode(65279); // was '↣';

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
  if (currentSlugTitle === apos.slugify(originalTitle)) {
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
// returning an array of zero or more nonempty strings. Must match
// server side implementation
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
    // Tags are always lowercase otherwise they will not compare
    // properly in MongoDB. If you want to change this then you'll
    // need to address that deeper issue
    return (tag + '').toLowerCase();
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
  return result;
};

// Fix lame URLs. If we can't fix the URL, return null.
//
// Accepts valid URLs and relative URLs. If the URL smells like
// it starts with a domain name, supplies an http:// prefix.
//
// KEEP IN SYNC WITH apostrophe.js SERVER SIDE VERSION

apos.fixUrl = function(href) {
  if (href.match(/^(((https?|ftp)\:\/\/)|mailto\:|\#|([^\/\.]+)?\/|[^\/\.]+$)/)) {
    // All good - no change required
    return href;
  } else if (href.match(/^[^\/\.]+\.[^\/\.]+/)) {
    // Smells like a domain name. Educated guess: they left off http://
    return 'http://' + href;
  } else {
    return null;
  }
};

// Keep all older siblings of node, remove the rest (including node) from the DOM.
apos.keepOlderSiblings = function(node) {
  while (node) {
    var next = node.nextSibling;
    node.parentNode.removeChild(node);
    node = next;
  }
};

// Append all DOM sibling nodes after node, including
// text nodes, to target.
apos.moveYoungerSiblings = function(node, target) {
  var sibling = node.nextSibling;
  while (sibling) {
    var next = sibling.nextSibling;
    target.insertBefore(sibling, null);
    sibling = next;
  }
};

// Enable autocomplete of tags. Expects the fieldset element
// (not the input element) and an array of existing tags already
// assigned to this item.
apos.enableTags = function($el, tags) {
  tags = tags || [];
  $el.selective({ preventDuplicates: true, add: true, data: tags, source: '/apos/autocomplete-tag', addKeyCodes: [ 13, 188] });
};

// Set things up to instantiate the media library when the button is clicked. This is set up
// to allow subclassing with an alternate constructor function

apos.enableMediaLibrary = function() {
  $('body').on('click', '.apos-media-library-button', function() {
    if (!apos.data.mediaLibraryOptions) {
      apos.data.mediaLibraryOptions = {};
    }
    var Construct = apos.data.mediaLibraryOptions.construct || AposMediaLibrary;
    var mediaLibrary = new (Construct)(apos.mediaLibraryOptions);
    mediaLibrary.modal();
    return false;
  });
};

// Simple progress display. Locates a progress display inside the given
// element. If state is true, indicates activity, otherwise indicates
// complete. Supports nested calls; does not revert to indicating complete
// until the nesting level is 0.

apos.busy = function($el, state) {
  var busy = $el.data('busy') || 0;
  if (state) {
    busy++;
    $el.data('busy', busy);
    if (busy === 1) {
      $el.find('[data-progress]').show();
      $el.find('[data-finished]').hide();
    }
  } else {
    busy--;
    $el.data('busy', busy);
    if (!busy) {
      $el.find('[data-progress]').hide();
      $el.find('[data-finished]').show();
    }
  }
};

// Do this late so that other code has a chance to set apos.mediaLibraryOptions
$(function() {
  apos.afterYield(function() {
    apos.enableMediaLibrary();
  });
});

