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
    var $widget = $(this);
    
    if($widget.closest('.apos-no-player').length) {
      //return;
    };

    var type = $widget.attr('data-type');
    if (apos.widgetPlayers[type]) {
      apos.widgetPlayers[type]($widget);
    }
  });
};

// When apos.change('blog') is invoked, the following things happen:
//
// 1. All elements wih the data-apos-trigger-blog attribute receive an
// apos-change-blog jQuery event.
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
  var sel = '[data-apos-trigger-' + what + ']';
  $(sel).each(function() {
    var $el = $(this);
    $(this).trigger('apos-change-' + what);
  });
  $.get(window.location.href, { apos_refresh: apos.generateId() }, function(data) {
    // Make sure we run scripts in the returned HTML
    $('[data-apos-refreshable]').html($.parseHTML(data, document, true));
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

// This method will invoke its callback when all img elements
// contained in sel (including sel itself, if it is an image) have loaded
// completely. Note that sel can be a jquery object or a selector.
//
// If the imgSel argument is present, it is used to limit the set of
// image elements that are considered. However note that they must
// still be img elements as .complete is not available on backgrounds.
// You can skip the imgSel argument if you wish.
//
// The first argument to the callback is the maximum width
// of all of the images, the second is the maximum height. The third
// is the highest ratio of height to width encountered. This is useful
// for determining the height of a slideshow with an externally
// determined width.
//
// Useful when you need to calculate sizes that depend on images or
// just want to wait for all of the images to exist.

apos.whenImagesReady = function(sel, imgSel, callback) {
  var $el = $(sel);
  if (!callback) {
    // imgSel argument is skippable
    callback = imgSel;
    imgSel = null;
  }
  var $images = $el.find('img').add($el.filter('img'));
  if (imgSel) {
    $images = $images.filter(imgSel);
  }


  function attempt() {
    var ready = true;
    var maxWidth = 0;
    var maxHeightToWidth = 0 ;
    var maxHeight = 0;
    var tmp = new Image();
    $images.each(function(i, item) {
      if (!item.complete) {
        ready = false;
        return;
      }
      var $item = $(item);
      tmp.src = $item.attr('src');
      var width = tmp.width;
      var height = tmp.height;
      if (width > maxWidth) {
        maxWidth = width;
      }
      if (height > maxHeight) {
        maxHeight = height;
      }
      if (width && height) {
        var heightToWidth = height / width;
        if (heightToWidth > maxHeightToWidth) {
          maxHeightToWidth = heightToWidth;
        }
      }
    });
    if (ready) {
      return callback(maxWidth, maxHeight, maxHeightToWidth);
    } else {
      setTimeout(attempt, 50);
    }
  }

  attempt();
};

apos.widgetPlayers = {};

apos.widgetPlayers.slideshow = function($widget)
{
  // TODO take the interval from data attributes, add arrows based on
  // data attributes, and so on. Include controls in the form to set
  // those options. Consider allowing for titles and descriptions.
  // Support all those cool fades we love to do. Et cetera, et cetera.

  var interval;

  function reset() {
    if (interval) {
      clearInterval(interval);
    }
    interval = setInterval(function() {
      if (!getCurrent().length) {
        // Widget has gone away. Kill the interval timer and go away too
        clearInterval(interval);
      }
      next();
    }, 5000);
  }

  reset();

  $widget.find('[data-previous]').click(function() {
    previous();
    return false;
  });

  $widget.find('[data-next]').click(function() {
    next();
    return false;
  });

  function getCurrent() {
    var $current = $widget.find('[data-slideshow-item].apos-current');
    return $current;
  }

  function previous() {
    var $current = getCurrent();
    var $prev = $current.prev();
    if (!$prev.length) {
      $prev = $current.closest('[data-slideshow-items]').find('[data-slideshow-item]:last');
    }
    $current.removeClass('apos-current');
    $prev.addClass('apos-current');
    // A fresh n seconds for the next auto rotate
    reset();
  }

  function next() {
    var $current = getCurrent();
    if (!$current.length) {
      // Widget has gone away. Kill the interval timer and go away too
      clearInterval(interval);
      return;
    }
    var $next = $current.next();
    if (!$next.length) {
      $next = $current.closest('[data-slideshow-items]').find('[data-slideshow-item]:first');
    }
    $current.removeClass('apos-current');
    $next.addClass('apos-current');
    // A fresh n seconds for the next auto rotate
    reset();
  }

  function adjustSize() {
    apos.whenImagesReady($widget, '[data-image]', function(maxWidth, maxHeight, maxHeightToWidth) {
      var proportion = $widget.width() * maxHeightToWidth;

      if(!$widget.parents().hasClass('apos-no-height')) {
        $widget.find('[data-slideshow-items]').height(proportion);
        $widget.height(proportion);
      }

    });
  }

  adjustSize();
};

// The video player replaces a thumbnail with
// a suitable player via apos's oembed proxy

apos.widgetPlayers.video = function($widget)
{
  var videoUrl = $widget.attr('data-video');
  $.get('/apos/oembed', { url: videoUrl }, function(data) {
    // Wait until the thumbnail image size is available otherwise we'll
    // get a tiny size for the widget
    apos.whenImagesReady($widget, function() {
      var e = $(data.html);
      e.removeAttr('width');
      e.removeAttr('height');
      e.width($widget.width());
      e.height($widget.height());
      $widget.html(e);
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
  // It's not uncommon to have duplicates of a template that hasn't
  // been overridden for a derived type yet. Behave well in this case
  $el = $el.filter(':first');

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

  var $item = $(sel).filter('.apos-template').clone();
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

// Anywhere you have a form and want to manipulate it with jQuery,
// these functions will get you past the nonsense of val() not working
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
      matches = time.match(/^(\d+):(\d+):(\d+)$/);
      return matches[1] + ':' + matches[2];
    }
  } else {
    matches = time.match(/^(\d+):(\d+):(\d+)$/);
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
// sensible property names
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

// Return complete markup for an element. Not all browsers
// support outerHTML natively. This is useful when dealing with
// APIs that require raw markup, including rich text editing

apos.outerHTML = function(e) {
  var wrapper = $('<div></div>');
  wrapper.append($(e).clone());
  return wrapper.html();
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

// Infinite scroll.
//
// REQUIRED OPTIONS
//
// 'url' is the URL to fetch new pages from. The URL should return an HTML fragment
// containing one page's worth of content, based on the 'page' parameter to the URL.
// Page numbers start from 1. The content will be appended to 'el'.
//
// 'el' is the jQuery selector, jQuery object or DOM element to append new pages
// of content to. It should be initially empty (if you are using 'now') or be
// prepopulated with the content of page 1.
//
// OTHER OPTIONS
//
// 'page' specifies the initial page number and defaults to 1, which assumes you are
// preloading one page of content already. If you are not preloading any content and
// wish the first page to load immediately, set 'now' to true and do not set 'page'.
//
// Set 'now' to trueto load the first page immediately. You do not have to
// set 'page' if you set 'now'.
//
// 'criteria' contains additional query parameters and is often used when additional
// filtering options besides pagination are available. You can also bake additional
// parameters into the URL of course. However note the 'reset' event below.
//
// 'trigger' is the distance in pixels from the bottom of the page at which the loading
// of a new page is triggered. This hopefully prevents the user from staring at a
// spinner too often. It defaults to 350.
//
// 'method' can be used to change the HTTP method from GET to POST.
//
// 'spinner' is a selector, jQuery object or DOM element to be displayed while
// a page is loading.
//
// 'distance' is the distance, in pixels, from being able to see the bottom of the page
// at which the next page begins loading, hopefully preventing the user from waiting
// in most cases. 'distance' defaults to 350.
//
// EVENTS
//
// You can trigger an 'apos.scroll.reset' event to 'el' on clear 'el' and reload page one.
// You can also provide new criteria for the query when triggering this event:
//
// $('.posts').trigger('apos.scroll.reset', [ { tag: 'blue' } ])
//
// infiniteScroll will trigger the following events on 'el' on its own:
//
// 'apos.scroll.started' means page loading has begun.
// 'apos.scroll.stopped' means page loading has just stopped (whether successfully or not).
// 'apos.scroll.loaded' means a page has just been loaded successfully.
//
// PROPERTIES
//
// Assuming $('.posts') is your 'el', you may check whether the element is currently
// loading a page with:
//
// $('.posts').data('loading')
//
// You may check the current page number with:
//
// $('.posts').data('page')

apos.infiniteScroll = function(options) {
  var url = options.url;
  var now = options.now || false;
  var page = options.page || 1;
  if (now) {
    if (options.page === undefined) {
      // loadPage will increment this and load page one immediately
      options.page = 0;
    }
  }
  var criteria = options.criteria || {};
  var distance = options.distance || 350;
  var method = options.method || 'GET';
  var $el = $(options.el);
  var $spinner = $(options.spinner);
  var atEnd = false;
  var loading = false;

  // Infinite scroll
  setInterval(function() {
    if ((!atEnd) && (!loading)) {
      if (($(document).scrollTop() + $(window).height() + distance) >= $(document).height())
      {
        loadPage();
      }
    }
  }, 100);

  $el.on('apos.scroll.reset', function(e, data) {
    if (data) {
      criteria = data;
    }
    reset();
  });

  function reset() {
    $el.html('');
    page = 0;
    atEnd = false;
    start();
    loadPage();
  }

  function loadPage() {
    page++;
    loading = true;
    $el.data('loading', true);
    // Copy the criteria and add the page
    var query = $.extend(true, criteria, {
      page: page
    });
    $.ajax({
      url: url,
      type: method,
      data: query,
      success: function(data) {
        var $items = $.parseHTML(data);
        $el.append($items);
        $el.data('page', page);
        $el.trigger('apos.scroll.loaded');
        stop();
      },
      error: function() {
        $el.data('loading', false);
        loading = false;
      },
      statusCode: {
        404: function() {
          stop();
          end();
        }
      }
    });
  }

  function start() {
    $el.data('loading', true);
    loading = true;
    $el.trigger('apos.scroll.started');
    $spinner.show();
  }

  function stop() {
    $el.data('loading', false);
    loading = false;
    $el.trigger('apos.scroll.stopped');
    $spinner.hide();
  }

  function end() {
    $el.data('loading', false);
    atEnd = true;
    $el.trigger('apos.scroll.ended');
    $spinner.hide();
  }

  if (now) {
    loadPage();
  }
};

// MINOR JQUERY EXTENSIONS

(function( $ ){
  // Less bug-prone way to find things by name attribute
  $.fn.findByName = function(name) {
    return this.find('[name=' + name + ']');
  };
})( jQuery );
