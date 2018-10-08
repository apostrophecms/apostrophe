/* global XRegExp, rangy, $, _ */
/* global alert, prompt, AposMediaLibrary, AposTagEditor, aposPages */

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

var defaultWidgetTypes = [ 'slideshow', 'buttons', 'marquee', 'files', 'video', 'embed', 'pullquote', 'code', 'html' ];

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


// KEEP IN SYNC WITH SERVER SIDE IMPLEMENTATION in search.js

apos.slugify = window.sluggo;

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

// Given an array of items for an area, return true if the area
// is considered empty. TODO: this is a lousy hack right now,
// we don't have the capabilities we do on the server side to
// identify empty blog widgets, etc.

apos.areaIsEmpty = function(area) {
  return !_.find(area, function(item) {
    if ((item.type === 'slideshow') && (!(item.ids && item.ids.length))) {
      return false;
    }
    return true;
  });
};

// Given an array of items for a singleton, return true if the
// singleton is considered empty. TODO: right now this just
// calls apos.areaIsEmpty, it should take the type into
// account.

apos.singletonIsEmpty = function(area, type) {
  return apos.areaIsEmpty(area);
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
// Options are passed in from addFields
apos.enableTags = function($el, tags, field) {
  tags = tags || [];
  field = field || {};
  if (apos.data.lockTags) {
    $el.find('[data-add]').remove();
  }
  if (!field.limit) {
    field.limit = undefined;
  }
  if (!field.sortable) {
    field.sortable = undefined;
  }
  $el.selective({ preventDuplicates: true, add: !apos.data.lockTags, data: tags, source: '/apos/autocomplete-tag', addKeyCodes: [ 13, 'U+002C'], limit: field.limit, sortable: field.sortable, nestGuard: '[data-selective]' });
};

// Initialize a yes/no select element. If value is undefined (not just false),
// def is used.
apos.enableBoolean = function($el, value, def) {
  if (value === undefined) {
    value = def;
  }
  value = value ? '1' : '0';
  $el.val(value);
};

// Return the value of a yes/no select element as a proper
// boolean (true or false).

apos.getBoolean = function($el) {
  var val = $el.val();
  // Quoted string '0' is considered truthy, fix that
  if (val === '0') {
    return false;
  }
  return !!val;
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

// Area editing is in apostrophe-editor-2, but
// singleton editing still lives in the core
apos.enableSingletons = function() {
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
          $.jsonCall('/apos/edit-singleton',
            {
              dataType: 'html',
            },
            {
              slug: slug,
              options: JSON.parse($singleton.attr('data-options') || {}),
              // By now itemData has been updated (we passed it
              // into the widget and JavaScript passes objects by reference)
              content: itemData
            },
            function(markup) {
              $singleton.find('.apos-content').html(markup);
              apos.enablePlayers($singleton);
              apos.emit('edited', $singleton);
              callback(null);
            },
            function() {
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
  $('body').on('click', '[data-page-versions]', function() {
    var slug = $(this).attr('data-page-versions');
    aposPages.browseVersions({ slug: slug });
    return false;
  });

};

apos.enableAreas = function() {
  apos.log('DEPRECATED: you do not have to call apos.enableAreas anymore. This stub is going away in 0.6.');
};

$(function() {
  // Do these late so that other code has a chance to override
  // None of these need to happen again on 'ready' events, so
  // just do them once
  apos.afterYield(function() {
    apos.enableMediaLibrary();
    apos.enableTagEditor();
    apos.enableSingletons();
  });
});
