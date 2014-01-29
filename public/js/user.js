/* global XRegExp, rangy, $, _ */
/* global alert, prompt, AposMediaLibrary, AposTagEditor */

if (!window.apos) {
  window.apos = {};
}

$( document ).tooltip({
  show: { effect: "fadeIn", duration: 200 },
  hide: { effect: "fadeOut", duration: 200 },
  position: { my: "left top+10", at: "left bottom" }
});

var apos = window.apos;

apos.widgetTypes = {};

var defaultWidgetTypes = [ 'slideshow', 'buttons', 'marquee', 'files', 'video', 'pullquote', 'code', 'html' ];

// Add a widget type on the browser side. If typeName is `slideshow`, then Apostrophe invokes
// the constructor function named `AposSlideshowWidgetEditor`, unless
// `apos.data.widgetOptions.slideshow.constructorName` has been set to another name.
// This means your server-side code can specify an alternate constructor by calling:
//
//     apos.pushGlobalData({
//       widgetOptions: {
//         slideshow: {
//           constructorName: 'MySlideshowEditor'
//         }
//       }
//     })
//
// If you are developing your own widgets you should specify your own defaultConstructorName
// so that you can avoid conflicts with future widgets in the Apos namespace.
//
// This happens after domready so that all javascript inline in the page, including
// the calls that set up `apos.data`, can complete first.

apos.addWidgetType = function(typeName, defaultConstructorName) {
  $(function() {
    var constructorName = (apos.data.widgetOptions && apos.data.widgetOptions[typeName] && apos.data.widgetOptions[typeName].constructorName) || defaultConstructorName || ('Apos' + apos.capitalizeFirst(typeName) + 'WidgetEditor');
    var Constructor = window[constructorName];
    try {
      apos.widgetTypes[typeName] = {
        label: Constructor.label,
        editor: Constructor
      };
      // Allows properties known about the widget on the server side to be
      // seen on the browser side
      $.extend(true, apos.widgetTypes[typeName], (apos.data.widgetOptions && apos.data.widgetOptions[typeName]) || {});
    } catch (e) {
      apos.log('Error constructing widget ' + typeName + ', expected constructor function named ' + constructorName + ', error was:');
      throw e;
    }
  });
};

_.each(defaultWidgetTypes, function(type) {
  apos.addWidgetType(type);
});

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
            content: apos.stringifyArea(area)
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
    var editor = new apos.widgetTypes[type].editor({
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
    editor.init();
    return false;
  });
};

// KEEP IN SYNC WITH SERVER SIDE IMPLEMENTATION in search.js
// ONE punctuation character normally forbidden in slugs may optionally
// be permitted by specifying it via options.allow. For implementation
// reasons, this character may not be ʍ (upside down lowercase w).

apos.slugify = function(s, options) {

  // By default everything that matches the XRegExp groups
  // "Punctuation", "Separator", "Other" and "Symbol" becomes a dash.
  // You can change the separator with options.separator

  if (!options) {
    options = {};
  }

  if (!options.separator) {
    options.separator = '-';
  }

  if (options.allow) {
    // Temporarily convert the allowed punctuation character to ʍ, which is
    // not punctuation and thus won't be removed when we clean out punctuation.
    // If JavaScript had character class subtraction this would not be needed

    // First remove any actual instances of ʍ to avoid unexpected behavior
    s = s.replace(new RegExp(apos.regExpQuote('ʍ'), 'g'), '');

    // Now / (or whatever options.allow contains) becomes ʍ temporarily
    s = s.replace(new RegExp(apos.regExpQuote(options.allow), 'g'), 'ʍ');
  }

  var r = '[\\p{Punctuation}\\p{Separator}\\p{Other}\\p{Symbol}]';
  var regex = new XRegExp(r, 'g');
  s = XRegExp.replace(s, regex, options.separator);
  // Turn ʍ back into the allowed character
  if (options.allow) {
    s = s.replace(new RegExp(apos.regExpQuote('ʍ'), 'g'), options.allow);
  }
  // Consecutive dashes become one dash
  var consecRegex = new RegExp(apos.regExpQuote(options.separator) + '+', 'g');
  s = s.replace(consecRegex, options.separator);
  // Leading dashes go away
  var leadingRegex = new RegExp('^' + apos.regExpQuote(options.separator));
  s = s.replace(leadingRegex, '');
  // Trailing dashes go away
  var trailingRegex = new RegExp(apos.regExpQuote(options.separator) + '$');
  s = s.replace(trailingRegex, '');
  // If the string is empty, supply something so that routes still match
  if (!s.length)
  {
    s = 'none';
  }
  s = s.toLowerCase();
  return s;
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
apos.stringifyArea = function($area) {
  return JSON.stringify($area.data('editor').serialize());
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
    if (!apos.data.mediaLibrary) {
      apos.data.mediaLibrary = {};
    }
    var constructorName = apos.data.mediaLibrary.constructorName || 'AposMediaLibrary';
    var mediaLibrary = new window[constructorName](apos.data.mediaLibrary);
    mediaLibrary.modal();
    return false;
  });
};

// Set things up to instantiate the tag editor when the button is clicked. This is set up
// to allow subclassing with an alternate constructor function

apos.enableTagEditor = function() {
  $('body').on('click', '.apos-tag-editor-button', function() {
    if (!apos.data.tagEditorOptions) {
      apos.data.tagEditorOptions = {};
    }
    var constructorName = apos.data.tagEditorOptions.constructorName || 'AposTagEditor';
    var tagEditor = new window[constructorName](apos.tagEditorOptions);
    tagEditor.modal();
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

// Do this late so that other code has a chance to override
$(function() {
  apos.afterYield(function() {
    apos.enableMediaLibrary();
    apos.enableTagEditor();
  });
});

