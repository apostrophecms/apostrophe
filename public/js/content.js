/* jshint undef: true */
/* global $, _ */
/* global alert, prompt */

if (!window.apos) {
  window.apos = {};
}

var apos = window.apos;

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
    if (apos.widgetPlayers[type]) {
      apos.widgetPlayers[type]($el);
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
    // elements just refreshed if needed
    $(function() {
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
  if (item.items.length) {
    return item.items[0];
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
  $el.projector();
};

// The video player replaces a thumbnail with
// a suitable player via apos's oembed proxy

apos.widgetPlayers.video = function($el)
{
  var videoUrl = $el.attr('data-video');
  $.get('/apos/oembed', { url: videoUrl }, function(data) {
    // Wait until the thumbnail image size is available otherwise we'll
    // get a tiny size for the widget
    $el.imagesReady(function() {
      var e = $(data.html);
      e.removeAttr('width');
      e.removeAttr('height');
      e.width($el.width());
      e.height($el.height());
      $el.html(e);
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

  $el.on('click', '.apos-cancel', hideModal);

  $el.on('click', '.apos-save', function() {
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
      $el.offset({ top: $('body').scrollTop() + 100, left: ($(window).width() - $el.outerWidth()) / 2 });
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
// Convert a name to camel case. Only digits and ASCII letters remain.
// Anything that isn't a digit or an ASCII letter prompts the next character
// to be uppercase. Useful in converting CSV with friendly headings into
// sensible property names. You can set options.capitalize if you want the
// first letter capitalized as well.

apos.camelName = function(s) {
  var i;
  var n = '';
  var nextUp = false;
  for (i = 0; (i < s.length); i++) {
    var c = s.charAt(i);
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

// Enable toggles. Note the use of $('body').on('click', 'selector'...)
// to avoid problems with elements added later

$(function() {
  $('body').on('click', '.apos-accordion-title', function(event){
    $(this).parent().find('.apos-accordion-items').toggleClass('open');
  });

  $('body').on('click', '.apos-preview-toggle', function(event){
    $('.apos-preview-toggle').toggleClass('previewing');
    $('body').toggleClass('previewing');
  });

  // Close menus when an item is picked please!
  $('body').on('click', '.apos-accordion-items .apos-control', function() {
    $(this).closest('.apos-accordion-items').removeClass('open');
  });
});
