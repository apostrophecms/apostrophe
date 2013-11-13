/* global rangy, $, _ */
/* global alert, prompt, apos */

/**
 * @class An editor for Apostrophe areas. Integrates rich content editing with the editing
 * of multimedia widgets such as slideshows and videos, with mixed success. We're moving toward
 * a new implementation, and beginning by factoring this one out so its interface can be
 * seen clearly.
 *
 * Constructing the editor is a two-step process:
 *
 *     var editor = new AposEditor(options);
 *     editor.init()
 *
 * This makes it significantly easier to override methods when subclassing
 * the editor.
 */

function AposEditor(options) {
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
    var before = self.beforeMarker;
    var after = self.afterMarker;
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

 // We need to be able to do this to every single widget preview quickly when
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

  // Insert a newly created apos-widget
  self.insertWidget = function($widget) {
    // Newly created widgets need default position and size
    $widget.attr('data-position', 'middle');
    $widget.attr('data-size', 'full');
    $widget.addClass('apos-middle');
    $widget.addClass('apos-full');

    var markup = '';

    // Work around serious widget selection bugs in Chrome by introducing
    // characters before and after the widget that become part of selecting it
    var before = self.beforeMarker;
    var after = self.afterMarker;

    markup = before;

    var widgetWrapper = $('<div></div>').append($widget);
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

  // Serialize the contents of the editor to an array of items. This takes
  // quite a bit of cleanup work.
  self.serialize = function() {
    var content = self.$editable.html();
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
      richText = apos.globalReplace(richText, self.beforeMarker, '');
      richText = apos.globalReplace(richText, self.afterMarker, '');

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
          // If the widget has content that lives in the markup, fetch it via the
          // appropriate selector or get all of the text
          if (apos.widgetTypes[type].content) {
            if (apos.widgetTypes[type].contentSelector) {
              item.content = $(child).find(apos.widgetTypes[type].contentSelector).text();
            } else {
              item.content = $(child).text();
            }
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

  self.beforeMarker = String.fromCharCode(65279); // was '↢';
  self.afterMarker = String.fromCharCode(65279); // was '↣';

  self.init = function() {
    self.$el = $(options.selector);
    // So serialize can be invoked from the outside world in a standardized way
    // For code expecting a standalone editor
    self.$el.data('editor', self);
    // For code expecting an apos-area as the wrapper
    self.$el.closest('.apos-area').data('editor', self);
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
    self.$editable.find('.apos-widget[data-type]').before(self.beforeMarker).after(self.afterMarker);

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

    // Buttons that launch editors derived from widgetEditor for the purpose of
    // constructing a new widget

    self.$el.find('[data-widgetButton]').click(function() {
      var widgetType = $(this).attr('data-widgetButton');
      var options = areaOptions[widgetType] || {};
      try {
        var widgetEditor = new apos.widgetTypes[widgetType].editor({ editor: self, options: options });
        widgetEditor.init();
      } catch (e) {
        apos.log('Error initializing widget of type ' + widgetType);
        throw e;
      }
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
      try {
        var widgetEditor = new apos.widgetTypes[widgetType].editor(
        {
          editor: self,
          widgetId: widgetId,
          options: options
        });
        widgetEditor.init();
      } catch (e) {
        apos.log('Error initializing widget of type ' + widgetType);
        throw e;
      }
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
        var before = self.beforeMarker;
        var after = self.afterMarker;
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
