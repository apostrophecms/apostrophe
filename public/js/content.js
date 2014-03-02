/* jshint undef: true */
/* global $, _ */
/* global alert, prompt */

if (!window.apos) {
  window.apos = {};
}

var apos = window.apos;
var polyglot = new Polyglot();
// the function below is just an alias, to make things look more consistent
// between the server and the client side i18n
var __ = function(key,options){ return polyglot.t(key, options); };

(function() {
  /* jshint devel: true */
  apos.log = function(msg) {
    if (console && apos.log) {
      console.log(msg);
    }
  };
})();


// Correct way to get data associated with a widget in the DOM
apos.getWidgetData = function($widget) {
  var data = $widget.attr('data');
  if (data && data.length) {
    data = JSON.parse(data);
  } else {
    data = {};
  }
  // These two separate properties are authoritative for now
  // so that we can pace ourselves in refactoring the relevant code
  data.position = $widget.attr('data-position');
  data.size = $widget.attr('data-size');
  return data;
};

// An extensible way to fire up javascript-powered players for
// the normal views of widgets that need them

apos.enablePlayers = function(sel) {
  if (!sel) {
    sel = 'body';
  }
  $(sel).find('.apos-widget').each(function() {
    var $el = $(this);

    // TODO switch this to a jsonOption
    if($el.closest('.apos-no-player').length) {
      return;
    }

    var type = $el.attr('data-type');
    if (!$el.data('aposPlayerEnabled')) {
      if (apos.widgetPlayers[type]) {
        apos.widgetPlayers[type]($el);
        $el.data('aposPlayerEnabled', true);
      }
    }
  });
};

// When apos.change('blog') is invoked, the following things happen:
//
// 1. All elements wih the data-apos-trigger-blog attribute receive an
// aposChangeBlog jQuery event.
//
// 2. The main content area (the data-apos-refreshable div) is
// refreshed via an AJAX request, without refreshing the entire page.
// This occurs without regard to the `what` parameter because there are
// too many ways that the main content area can be influenced by any
// change made via the admin bar. It's simplest to refresh the
// entire content zone and still much faster than a page refresh.
//
// Note that this means there is no point in using data-apos-trigger-blog
// attributes in the main content area. Those are mainly useful in dialogs
// created by the admin bar, for instance to refresh the "manage" dialog
// when an edit or delete operation succeeds.

apos.change = function(what) {
  var sel = '[data-apos-trigger-' + apos.cssName(what) + ']';
  $(sel).each(function() {
    var $el = $(this);
    $(this).trigger(apos.eventName('aposChange', what));
  });
  $.get(window.location.href, { apos_refresh: apos.generateId() }, function(data) {
    // Make sure we run scripts in the returned HTML
    $('[data-apos-refreshable]').html($.parseHTML(data, document, true));
    // Trigger the aposReady event so scripts can attach to the
    // elements just refreshed if needed. Also trigger apos.enablePlayers.
    // Note that calls pushed by pushGlobalCalls are NOT run on a refresh as
    // they generally have to do with one-time initialization of the page
    $(function() {
      apos.enablePlayers();
      $("body").trigger("aposReady");
    });
  });
};

// Given a page object retrieved from the server (such as a blog post) and an
// area name, return the first image object found in that area, or undefined
// if there is none. TODO: make it possible for more widget types to declare that they
// contain this sort of thing. Right now it only looks at slideshows.
//
// This method is for situations where you want to show an image dynamically on the
// browser side. More typically we render views on the server side, but there are
// times when this is convenient.

apos.getFirstImage = function(page, areaName) {
  if (!page.areas[areaName]) {
    return undefined;
  }
  var area = page.areas[areaName];
  var item = _.find(area.items, function(item) {
    return item.type === 'slideshow';
  });
  if (!item) {
    return undefined;
  }
  if (item._items && item._items.length) {
    return item._items[0];
  }
  return undefined;
};

// Given a file object (as found in a slideshow widget for instance),
// return the file URL. If options.size is set, return the URL for
// that size (one-third, one-half, two-thirds, full). full is
// "full width" (1140px), not the original. For the original, don't pass size
apos.filePath = function(file, options) {
  var path = apos.data.uploadsUrl + '/files/' + file._id + '-' + file.name;
  if (!options) {
    options = {};
  }
  if (options.size) {
    path += '.' + options.size;
  }
  // NOTE: the crop must actually exist already, you can't just invent them
  // browser-side without the crop API never having come into play
  if (file.crop) {
    var c = file.crop;
    path += '.' + c.left + '.' + c.top + '.' + c.width + '.' + c.height;
  }
  return path + '.' + file.extension;
};

apos.widgetPlayers = {};

apos.widgetPlayers.slideshow = function($el)
{
  // Use our jQuery slideshow plugin
  var data = apos.getWidgetData($el);
  $el.projector({
    noHeight: data.noHeight,
    delay: data.delay
  });
};
apos.widgetPlayers.marquee = function($el)
{
  // Use our jQuery slideshow plugin
  var data = apos.getWidgetData($el);
  $el.projector({
    noHeight: data.noHeight,
    delay: data.delay
  });
};

// The video player replaces a thumbnail with
// a suitable player via apos's oembed proxy

apos.widgetPlayers.video = function($el)
{
  var data = apos.getWidgetData($el);
  var videoUrl = data.video;
  $.get('/apos/oembed', { url: videoUrl }, function(data) {
    // Wait until the thumbnail image size is available otherwise we'll
    // get a tiny size for the widget
    $el.imagesReady(function() {
      // We want to replace the thumbnail with the video while preserving
      // other content such as the title
      var e = $(data.html);
      e.removeAttr('width');
      e.removeAttr('height');
      var $thumbnail = $el.find('.apos-video-thumbnail');
      e.width($thumbnail.width());
      // If oembed results include width and height we can get the
      // video aspect ratio right
      if (data.width && data.height) {
        e.height((data.height / data.width) * $thumbnail.width());
      } else {
        // No, so we have to hope the thumbnail dimensions are a good bet
        e.height($thumbnail.height());
      }
      $el.find('.apos-video-thumbnail').replaceWith(e);
      // Hoist out of the link that launched us
      var $kids = $el.find('[data-apos-play] *').detach();
      $el.find('[data-apos-play]').replaceWith($kids);
    });
  });
};

// MODALS AND TEMPLATES

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
//
// data-save and data-cancel attributes are accepted as synonyms for .apos-save
// and .apos-cancel classes and are preferred in new code.

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

  function closeModal() {
    var topModal = apos.getTopModalOrBody();
    if (topModal.filter('.apos-modal')) {
      topModal.trigger('aposModalHide');
      return false;
    } else {
      return true;
    }
  }

  function cancelModal() {
    return options.beforeCancel(function(err) {
      if (err) {
        return;
      }
      return closeModal();
    });
  }

  if (!apos._modalInitialized) {
    apos._modalInitialized = true;
    // Just ONE event handler for the escape key so we don't have
    // modals falling all over themselves to hide each other
    // consecutively.

    // Escape key should dismiss the top modal, if any

    // $(document).on('keyup.aposModal', function(e) {
    //   // console.log(e);

    // });

    $( document ).on({
      'keyup.aposModal': function(e) {
        if (e.keyCode === 27) {
          cancelModal();
        }
      },
      'click.aposModal': function(e) {
        if (e.target.className === 'apos-modal-blackout'){
          cancelModal();
        }
      }
    });
  }

  var $el = $(sel);

  if (!options) {
    options = {};
  }

  _.defaults(options, {
    init: function(callback) {callback(null);},
    save: function(callback) {callback(null);},
    afterHide: function(callback) {callback(null);},
    beforeCancel: function(callback) {callback(null);}
  });

  $el.on('aposModalHide', function() {
    // TODO consider what to do if this modal is not the top.
    // It's tricky because some need to be removed rather than
    // merely hid. However we don't currently dismiss modals other
    // than the top, so...

    // Reset scroll position to what it was before this modal opened.
    // Really awesome if you scrolled while using the modal
    var $current = apos.getTopModalOrBody();
    if ($current.data('aposSavedScrollTop') !== undefined) {
      $(window).scrollTop($current.data('aposSavedScrollTop'));
    }

    apos._modalStack.pop();
    var blackoutContext = apos.getTopModalOrBody();
    var blackout = blackoutContext.find('.apos-modal-blackout');
    if (blackout.data('interval')) {
      clearInterval(blackout.data('interval'));
    }
    blackout.remove();
    $el.hide();
    apos.popSelection();
    options.afterHide(function(err) {
      return;
    });
    if (!apos._modalStack.length) {
      // Leggo of the keyboard when there are no modals!
      // We can reinstall the handler when it's relevant.
      // Fewer event handlers all the time = better performance
      apos._modalInitialized = false;
      $(document).off('keyup.aposModal');
      $(document).off('click.aposModal');
    }
  });

  function hideModal() {
    $el.trigger('aposModalHide');
    return false;
  }

  function saveModal(next) {
    options.save(function(err) {
      if(!err) {
        hideModal();
        if (next) {
          options.next();
        }
      }
    });
  }

  // Enter key driven submits of the form should act like a click on the save button,
  // do not try to submit the form old-school
  $el.on('submit', 'form', function() {
    saveModal();
    return false;
  });

  $el.on('click', '.apos-cancel,[data-cancel]', cancelModal);

  $el.on('click', '.apos-save,[data-save]', function() {
    var $button = $(this);
    saveModal($button.is('[data-next]'));
    return false;
  });

  apos.afterYield(function() {
    options.init(function(err) {
      if (err) {
        hideModal();
        return;
      }

      // Anytime we load new markup for a modal, it's appropriate to
      // offer an opportunity for progressive enhancement of controls,
      // for instance via lister
      apos.emit('enhance', $el);

      apos.pushSelection();



      // Black out the document or the top modal if there already is one.
      // If we are blacking out the body height: 100% won't cover the entire document,
      // so address that by tracking the document height with an interval timer
      var blackoutContext = apos.getTopModalOrBody();
      var blackout = $('<div class="apos-modal-blackout"></div>');
      if (blackoutContext.prop('tagName') === 'BODY') {
        var interval = setInterval(function() {
          var contextHeight = $(document).height();
          if (blackout.height() !== contextHeight) {
            blackout.height(contextHeight);
          }
          blackout.data('interval', interval);
        }, 200);
      }
      blackoutContext.append(blackout);
      // Remember scroll top so we can easily get back
      $el.data('aposSavedScrollTop', $(window).scrollTop());
      apos._modalStack.push($el);
      $('body').append($el);
      var offset;
      if ($el.hasClass('apos-modal-full-page')) {
        offset = $('.apos-admin-bar').height();
      } else {
        offset = 100;
      }
      $el.offset({ top: $('body').scrollTop() + offset, left: ($(window).width() - $el.outerWidth()) / 2 });
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

// SELECTIONS

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

// DOM TEMPLATES

// Clone the element matching the selector which also has the
// .apos-template class, remove the apos-template class from the clone, and
// return the clone. This is convenient for turning invisible templates
// already present in the DOM into elements ready to add to the document.
//
// Options are available to populate the newly returned element with content.
// If options.text is { label: '<bob>' }, fromTemplate will look for a descendant
// with the data-label attribute and set its text to <bob> (escaping < and > properly).
//
// If options.text is { address: { street: '569 South St' } },
// fromTemplate will first look for the data-address element, and then
// look for the data-street element within that and populate it with the
// string 569 South St. You may pass as many properties as you wish,
// nested as deeply as you wish.
//
// For easier JavaScript coding, properties are automatically converted from
// camel case to hyphenation. For instance, the property userName will be
// applied to the element with the attribute data-user-name.
//
// If options.text is { name: [ 'Jane', 'John', 'Bob' ] }, the
// element with the data-name property will be repeated three times, for a total of
// three copies given the text Jane, John and Bob.
//
// options.html functions exactly like options.text, except that the
// value of each property is applied as HTML markup rather than as plaintext.
// That is, if options.html is { body: '<h1>bob</h1>' },
// fromTemplate will look for an element with the data-body attribute
// and set its content to the markup <h1>bob</h1> (which will create an
// h1 element). You may nest and repeat elements just as you do with options.text.
//
// Since not every situation is covered by these options, you may wish to
// simply nest templates and manipulate things directly with jQuery. For instance,
// an li list item template can be present inside a ul list template. Just call
// apos.fromTemplate again to start making clones of the inner template and adding
// them as appropriate. It is often convenient to remove() the inner template
// first so that you don't have to filter it out when manipulating list items.

apos.fromTemplate = function(sel, options) {
  options = options || {};

  var $item = $(sel).filter('.apos-template:first').clone();
  $item.removeClass('apos-template');

  function applyPropertyValue($element, fn, value) {
    if (typeof(value) === 'object') {
      applyValues($element, fn, value);
    } else {
      fn($item, value);
    }
  }

  function applyValues($item, fn, values) {
    _.each(values, function(value, key) {
      var $element = $item.find('data-' + apos.cssName(key));
      if (_.isArray(value)) {
        var $elements = [];
        var $e;
        for (var i = 1; (i < value.length); i++) {
          if (i === 0) {
            $e = $element;
          } else {
            $e = $element.clone();
            $element.after($e);
          }
          $elements.push($e);
        }
        for (i = 0; (i < value.length); i++) {
          applyPropertyValue($elements[i], fn, value[i]);
        }
        if (!value.length) {
          // Zero repetitions = remove the element
          $element.remove();
        }
      } else {
        applyPropertyValue($element, fn, value);
      }
    });
  }

  function text($item, value) {
    $item.text(value);
  }

  function html($item, value) {
    $item.html(value);
  }

  if (options.text) {
    applyValues($item, text, options.text);
  }

  if (options.html) {
    applyValues($item, html, options.html);
  }

  return $item;
};

// CONVENIENCES

// Enhance a plaintext date field with a nice jquery ui date widget.
// Just pass a jquery object referring to the text element as the
// first argument.
//
// Uses the YYYY-MM-DD format we use on the back end.
//
// If $minFor is set, any date selected for $el becomes the
// minimum date for $minFor. For instance, start_date should be the
// minimum date for the end_date field.
//
// Similarly, if $maxFor is set, any date selected for $el becomes the maximum
// date for $maxFor.

apos.enhanceDate = function($el, options) {
  if (!options) {
    options = {};
  }
  $el.datepicker({
    defaultDate: "+0w",
    dateFormat: 'yy-mm-dd',
    changeMonth: true,
    numberOfMonths: 1,
    onClose: function(selectedDate) {
      if (options.$minFor) {
        options.$minFor.datepicker( "option", "minDate", selectedDate);
      }
      if (options.$maxFor) {
        options.$maxFor.datepicker( "option", "maxDate", selectedDate);
      }
    }
  });
};

// Accepts a time in 24-hour HH:MM:SS format and returns a time
// in the user's preferred format as determined by apos.data.timeFormat,
// which may be either 24 or 12. Useful to allow 12-hour format editing
// of times previously saved in the 24-hour format (always used on the back end).
// Seconds are not included in the returned value unless options.seconds is
// explicitly true. If options.timeFormat is set to 24 or 12, that format is
// used, otherwise apos.data.timeFormat is consulted, which allows the format
// to be pushed to the browser via apos.pushGlobalData on the server side
//
// For convenience, the values null, undefined and empty string are returned as
// themselves rather than throwing an exception. This is useful when the absence of any
// setting is an acceptable value.
apos.formatTime = function(time, options) {
  if ((time === null) || (time === undefined) || (time === '')) {
    return time;
  }
  if (!options) {
    options = {};
  }
  var timeFormat = options.timeFormat || apos.data.timeFormat || 12;
  var showSeconds = options.seconds || false;
  var matches, hours, minutes, seconds, tail;
  if (apos.data.timeFormat === 24) {
    if (showSeconds) {
      return time;
    } else {
      matches = time.match(/^(\d+):(\d+)(:(\d+))?$/);
      return matches[1] + ':' + matches[2];
    }
  } else {
    matches = time.match(/^(\d+):(\d+)(:(\d+))?$/);
    hours = parseInt(matches[1], 10);
    minutes = matches[2];
    seconds = matches[3];
    tail = minutes;
    if (showSeconds) {
      tail += ':' + seconds;
    }
    if (hours < 1) {
      return '12:' + tail + 'am';
    }
    if (hours < 12) {
      return apos.padInteger(hours, 2) + ':' + tail + 'am';
    }
    if (hours === 12) {
      return '12:' + tail + 'pm';
    }
    hours -= 12;
    return apos.padInteger(hours, 2) + ':' + tail + 'pm';
  }
};

// KEEP IN SYNC WITH SERVER SIDE VERSION IN apostrophe.js
//
// Convert a name to camel case.
//
// Useful in converting CSV with friendly headings into sensible property names.
//
// Only digits and ASCII letters remain.
//
// Anything that isn't a digit or an ASCII letter prompts the next character
// to be uppercase. Existing uppercase letters also trigger uppercase, unless
// they are the first character; this preserves existing camelCase names.

apos.camelName = function(s) {
  var i;
  var n = '';
  var nextUp = false;
  for (i = 0; (i < s.length); i++) {
    var c = s.charAt(i);
    // If the next character is already uppercase, preserve that, unless
    // it is the first character
    if ((i > 0) && c.match(/[A-Z]/)) {
      nextUp = true;
    }
    if (c.match(/[A-Za-z0-9]/)) {
      if (nextUp) {
        n += c.toUpperCase();
        nextUp = false;
      } else {
        n += c.toLowerCase();
      }
    } else {
      nextUp = true;
    }
  }
  return n;
};

// Convert everything else to a hyphenated css name. Not especially fast,
// hopefully you only do this during initialization and remember the result
// KEEP IN SYNC WITH SERVER SIDE VERSION in apostrophe.js
apos.cssName = function(camel) {
  var i;
  var css = '';
  var dash = false;
  for (i = 0; (i < camel.length); i++) {
    var c = camel.charAt(i);
    var lower = ((c >= 'a') && (c <= 'z'));
    var upper = ((c >= 'A') && (c <= 'Z'));
    var digit = ((c >= '0') && (c <= '9'));
    if (!(lower || upper || digit)) {
      dash = true;
      continue;
    }
    if (upper) {
      if (i > 0) {
        dash = true;
      }
      c = c.toLowerCase();
    }
    if (dash) {
      css += '-';
      dash = false;
    }
    css += c;
  }
  return css;
};

// Create an event name from one or more strings. The original strings can be
// CSS names or camelized names, it makes no difference. The end result
// is always in a consistent format.
//
// Examples:
//
// apos.eventName('aposChange', 'blog') ---> aposChangeBlog
// apos.eventName('aposChangeEvents') ---> aposChangeEvents
// apos.eventName('apos-jump-gleefully') ---> aposJumpGleefully
//
// It doesn't matter how many arguments you pass. Each new argument
// is treated as a word boundary.
//
// This method is often useful both when triggering and when listening.
// No need to remember the correct way to construct an event name.

apos.eventName = function() {
  var args = Array.prototype.slice.call(arguments, 0);
  return apos.camelName(args.join('-'));
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

// String.replace does NOT do this
// Regexps can but they can't be trusted with unicode ):
// Keep in sync with server side version

apos.globalReplace = function(haystack, needle, replacement) {
  var result = '';
  while (true) {
    if (!haystack.length) {
      return result;
    }
    var index = haystack.indexOf(needle);
    if (index === -1) {
      result += haystack;
      return result;
    }
    result += haystack.substr(0, index);
    result += replacement;
    haystack = haystack.substr(index + needle.length);
  }
};

// pad an integer with leading zeroes, creating a string
apos.padInteger = function(i, places) {
  var s = i + '';
  while (s.length < places) {
    s = '0' + s;
  }
  return s;
};

/**
 * Capitalize the first letter of a string
 */
apos.capitalizeFirst = function(s) {
  return s.charAt(0).toUpperCase() + s.substr(1);
};

// Upgrade our CSS, JS and DOM templates to meet the requirements of another
// "scene" without refreshing the page, then run a callback. For instance:
//
// apos.requireScene('user', function() {
//   // Code inside here can assume all the good stuff is available
// });
//
// This method is smart enough not to do any expensive work if the user
// is already logged in or has already upgraded in the lifetime of this page.

apos.requireScene = function(scene, callback) {
  // Synchronously loading JS and CSS and HTML is hard! Apostrophe mostly
  // avoids it, because the big kids are still fighting about requirejs
  // versus browserify, but when we upgrade the scene to let an anon user
  // play with schema-driven forms, we need to load a bunch of JS and CSS
  // and HTML in the right order! What will we do?
  //
  // We'll let the server send us a brick of CSS, a brick of JS, and a
  // brick of HTML, and we'll smack the CSS and HTML into the DOM,
  // wait for DOMready, and run the JS with eval.
  //
  // This way the server does most of the work, calculating which CSS, JS
  // and HTML template files aren't yet in browserland, and the order of
  // loading within JS-land is reallllly clear.

  if (apos.scene === scene) {
    return callback(null);
  }
  $.jsonCall('/apos/upgrade-scene',
    {
      from: apos.scene,
      to: scene
    },
    function(result) {
      if ((!result) || (result.status !== 'ok')) {
        return callback('error');
      }
      if (result.css.length) {
        $("<style>" + result.css + "</style>").appendTo('head');
      }
      if (result.html.length) {
        $('body').append(result.html);
      }
      $('body').one('aposSceneChange', function(e, scene) {
        return callback(null);
      });
      $(function() {
        // Run it in the window context so it can see apos, etc.
        $.globalEval(result.js);
      });
    }
  );
};

// If the aposAfterLogin cookie is set and we are logged in,
// clear the cookie and redirect as appropriate. Called on DOMready,
// and also on the fly after anything that implicitly logs the user in.

apos.afterLogin = function() {
  var afterLogin = $.cookie('aposAfterLogin');
  if (afterLogin && apos.data.user) {
    $.removeCookie('aposAfterLogin', { path: '/' });

    // We can't just stuff afterLogin in window.location.href because
    // the browser won't refresh the page if it happens to be the current page,
    // and what we really want is all the changes in the outerLayout that
    // occur when logged in. So stuff a cache buster into the URL

    var offset = afterLogin.indexOf('#');
    if (offset === -1) {
      offset = afterLogin.length;
    }
    var insert = 'apcb=' + apos.generateId();
    if (afterLogin.match(/\?/)) {
      insert = '&' + insert;
    } else {
      insert = '?' + insert;
    }
    afterLogin = afterLogin.substr(0, offset) + insert + afterLogin.substr(offset);
    window.location.href = afterLogin;
  }
};

apos.handlers = {};

// Emit an Apostrophe event. All handlers that have been set
// with apos.on for the same eventName will be invoked. Any additional
// arguments are received by the handler functions as arguments.
// Currently the 'enhance' event is used to do progressive enhancement
// of material newly loaded into the DOM. TODO: merge this with
// the 'aposReady' jquery DOM event which is currently triggered on
// 'body'. We should think of all of it as progressive enhancement.
// To get that right we'll have to make lister play nice with elements
// that have already been enhanced once.

apos.emit = function(eventName /* ,arg1, arg2, arg3... */) {
  var handlers = apos.handlers[eventName];
  if (!handlers) {
    return;
  }
  var args = Array.prototype.slice.call(arguments, 1);
  var i;
  for (i = 0; (i < handlers.length); i++) {
    handlers[i].apply(window, args);
  }
};

// Install an Apostrophe event handler. The handler will be called
// when apos.emit is invoked with the same eventName. The handler
// will receive any additional arguments passed to apos.emit.

apos.on = function(eventName, fn) {
  apos.handlers[eventName] = (apos.handlers[eventName] || []).concat([ fn ]);
};

// Remove an Apostrophe event handler. If fn is not supplied, all
// handlers for the given eventName are removed.
apos.off = function(eventName, fn) {
  if (!fn) {
    delete apos.handlers[eventName];
    return;
  }
  apos.handlers[eventName] = _.filter(apos.handlers[eventName], function(_fn) {
    return fn !== _fn;
  });
};


// Progressive enhancement of select elements

apos.on('enhance', function($el) {
  $el.find('select[data-lister]:not(.apos-template select[data-lister])').lister({
    listClass: "apos-lister"
  });
});

// Everything in this DOMready block must be an event handler
// on 'body', optionally filtered to apply to specific elements,
// so that it can work on elements that don't exist yet.

$(function() {
  // Enable toggles. Note the use of $('body').on('click', 'selector'...)
  // to avoid problems with elements added later
  $('body').on('click', '.apos-accordion-title', function(event){
    // $(this).parent().find('.apos-accordion-items').toggleClass('open');
    $(this).parent().toggleClass('open');
    $(this).parent().siblings().removeClass('open');
  });

  $('body').on('click', '.apos-preview-toggle', function(event){
    $('.apos-preview-toggle').toggleClass('previewing');
    $('body').toggleClass('previewing');
  });

  // Close menus when an item is picked please!
  $('body').on('click', '.apos-accordion-items .apos-control', function() {
    $(this).closest('.apos-admin-bar-item').removeClass('open');
  });

  //sets up listeners for tabbed modals
  $('body').on('click', '.apos-modal-tab-title', function(){
    $(this).closest('.apos-modal-tabs').find('.apos-active').removeClass('apos-active');
    $(this).closest('.apos-modal-tabs').find('[data-tab-id="'+$(this).attr('data-tab')+'"]').addClass('apos-active');
    $(this).addClass('apos-active');
  });

  // Progressively enhance all elements present on the page at DOMready
  apos.emit('enhance', $('body'));

  // If the aposAfterLogin cookie is set and we are logged in,
  // clear the cookie and redirect as appropriate.

  apos.afterLogin();

  // If the URL ends in: #click-whatever
  //
  // ... Then we locate an element with the attribute data-whatever,
  // and trigger a click event on it.
  //
  // This is useful for resuming an activity after requiring the user to log in.
  //
  // Waiting long enough for both the click and the autoscroll to work is
  // tricky. We need to yield beyond DOMready so that other code installing click
  // handlers on DOMready has had time to do so. And we need to yield a little
  // extra time or the browser will crush our efforts to set scrollTop based on
  // its own idea of where we are on the page (at least in Chrome). ):

  setTimeout(function() {
    var hash = window.location.hash;
    var matches = hash.match(/^\#click\-(.*)$/);
    if (matches) {
      var $element = $('[data-' + matches[1] + ']');
      if ($element.length) {
        // Scroll back to the right neighborhood
        var offset = $element.offset();
        var scrollTop = offset.top - 100;
        $('html, body').scrollTop(scrollTop);
        // Now carry out the action
        $('[data-' + matches[1] + ']').trigger('click');
      }
    }
  }, 200);
});
