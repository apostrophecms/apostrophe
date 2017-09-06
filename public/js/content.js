/* jshint undef: true */
/* global $, _ */
/* global alert, prompt */

if (!window.apos) {
  window.apos = {};
}

var apos = window.apos;

apos.version = "0.5.370";

apos.handlers = {};

// EVENT HANDLING
//
// apos.emit(eventName, /* arg1, arg2, arg3... */)
//
// Emit an Apostrophe event. All handlers that have been set
// with apos.on for the same eventName will be invoked. Any additional
// arguments are received by the handler functions as arguments.
//
// For bc, Apostrophe events are also triggered on the
// body element via jQuery. The event name "ready" becomes
// "aposReady" in jQuery. This feature will be removed in 0.6.
//
// CURRENT EVENTS
//
// 'enhance' is triggered to request progressive enhancement
// of form elements newly loaded into the DOM (jQuery selectize).
// It is typically used in admin modals.
//
// 'ready' is triggered when the main content area of the page
// has been refreshed.

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
  // BC (to be removed in 0.6): also trigger the event
  // on the body. The 'ready' event becomes 'aposReady' when
  // triggered on the body.
  //
  // trigger takes multiple arguments as an array
  $('body').trigger('apos' + apos.capitalizeFirst(eventName), args);
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
    // Trigger the 'ready' event so scripts can attach to the
    // elements just refreshed if needed. Also trigger apos.enablePlayers.
    // Note that calls pushed by pushGlobalCalls are NOT run on a refresh as
    // they generally have to do with one-time initialization of the page
    $(function() {
      apos.emit('ready');
    });
  });
};

apos.on('ready', function() {
  apos.enablePlayers();
});

// Given a page object retrieved from the server (such as a blog post) and an
// area name, return the first image object found in that area, or undefined
// if there is none. TODO: make it possible for more widget types to declare that they
// contain this sort of thing. Right now it only looks at slideshows.
//
// This method is for situations where you want to show an image dynamically on the
// browser side. More typically we render views on the server side, but there are
// times when this is convenient.
//
// TWO SYNTAX OPTIONS:
//
// apos.getFirstImage(page, 'body')
// apos.getFirstImage(page.body)
//
// The latter is best if you are dealing with an image nested in an
// array property etc.

apos.getFirstImage = function(/* area object, or: page, areaName */) {
  var area;
  if (arguments.length === 1) {
    area = arguments[0];
  } else {
    area = arguments[0][arguments[1]];
    if (!area) {
      return undefined;
    }
  }
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
  // NOTE: the crop must actually exist already, you can't just invent them
  // browser-side without the crop API never having come into play
  if (file.crop) {
    var c = file.crop;
    path += '.' + c.left + '.' + c.top + '.' + c.width + '.' + c.height;
  }
  if (options.size) {
    path += '.' + options.size;
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
  $.jsonCall('/apos/oembed', { url: videoUrl }, function(data) {
    // Wait until the thumbnail image size is available otherwise we'll
    // get a tiny size for the widget
    $el.imagesReady(function() {
      // We want to replace the thumbnail with the video while preserving
      // other content such as the title
      var $e = $(data.html);
      $e.removeAttr('width');
      $e.removeAttr('height');
      var $thumbnail = $el.find('.apos-video-thumbnail');
      if ($thumbnail.length) {
        $e.width($thumbnail.width());
      }
      // If oembed results include width and height we can get the
      // video aspect ratio right
      if (data.width && data.height) {
        $e.height((data.height / data.width) * $e.width());
      } else {
        // No, so assume the oembed HTML code is responsive.
        // Jamming the height to the thumbnail height is a mistake
        // $e.height($thumbnail.height());
      }

      // Hack: if our site is secure, fetch the embedded
      // item securely. This might not work for some providers,
      // but which do you want, a broken video or a scary
      // security warning?
      //
      // This hack won't work for everything but it's correct
      // for a typical iframe embed.

      if ($e.attr('src')) {
        $e.attr('src', apos.sslIfNeeded($e.attr('src')));
      }

      if ($thumbnail.length) {
        $el.find('.apos-video-thumbnail').replaceWith($e);
      } else {
        $el.append($e);
      }
      apos.emit('videoReady', $el);
    });
  });
};

apos.sslIfNeeded = function(url) {
  var ssl = ('https:' === document.location.protocol);
  if (ssl) {
    if (url.match(/^http:/)) {
      url = url.replace(/^http:/, 'https:');
    }
  }
  return url;
};

// The embed player populates the widget with the
// result of an oembed call, without attempting
// to fuss with its width or wait for a play button
// to be clicked as we do for video

apos.widgetPlayers.embed = function($el)
{
  var data = apos.getWidgetData($el);
  var query = {
    url: data.video,
    alwaysIframe: data.alwaysIframe,
    iframeHeight: data.iframeHeight
  };
  $.jsonCall('/apos/oembed', query, function(data) {
    if (data.html) {
      $el.append(data.html);
    }
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
    }
  }

  function cancelModal() {
    var topModal = apos.getTopModalOrBody();
    if (topModal.filter('.apos-modal')) {
      topModal.trigger('aposModalCancel');
    }
    // Important if we're a jquery event handler,
    // fixes jump scroll bug / addition of # to URL
    return false;
  }

  if (!apos._modalInitialized) {
    apos._modalInitialized = true;
    // Just ONE event handler for the escape key so we don't have
    // modals falling all over themselves to hide each other
    // consecutively.

    // Escape key should dismiss the top modal, if any

    $( document ).on({
      'keydown.aposModal': function(e) {
        if (e.keyCode === 27) {
          cancelModal();
          return false;
        }
      },
      'click.aposModal': function(e) {
        if (e.target.className === 'apos-modal-blackout'){
          cancelModal();
          return false;
        }
      }
    });
  }

  var $el = $(sel);
  var saving = false;

  if (!options) {
    options = {};
  }

  _.defaults(options, {
    init: function(callback) {callback(null);},
    save: function(callback) {callback(null);},
    afterHide: function(callback) {callback(null);},
    beforeCancel: function(callback) {callback(null);}
  });

  $el.on('aposModalCancel', function() {
    return options.beforeCancel(function(err) {
      if (err) {
        return;
      }
      return closeModal();
    });
  });

  $el.on('aposModalHide', function() {
    // TODO consider what to do if this modal is not the top.
    // It's tricky because some need to be removed rather than
    // merely hid. However we don't currently dismiss modals other
    // than the top, so...

    // Reset scroll position to what it was before this modal opened.
    // Really awesome if you scrolled while using the modal
    // TODO stop using the 'confirm' dialog box and implement an A2
    // version so the page doesn't scrollTop(0) when you click 'cancel'
    var $current = apos.getTopModalOrBody();

    var here = $current.data('aposSavedScrollTop') !== undefined ? $current.data('aposSavedScrollTop') : 0;
    $(window).scrollTop(here);

    apos._modalStack.pop();
    var blackoutContext = apos.getTopModalOrBody();
    var blackout = blackoutContext.find('.apos-modal-blackout');
    if (blackout.data('interval')) {
      clearInterval(blackout.data('interval'));
    }
    blackout.remove();
    $el.hide();
    options.afterHide(function(err) {
      return;
    });
    if (!apos._modalStack.length) {
      // Leggo of the keyboard when there are no modals!
      // We can reinstall the handler when it's relevant.
      // Fewer event handlers all the time = better performance
      apos._modalInitialized = false;
      $(document).off('keydown.aposModal');
      $(document).off('click.aposModal');
    }
  });

  function hideModal() {
    $el.trigger('aposModalHide');
    return false;
  }

  function saveModal(next) {
    if (saving) {
      // Avoid race conditions
      return;
    }
    saving = true;
    $el.find('.apos-save,[data-save]').addClass('apos-busy');
    options.save(function(err) {
      saving = false;
      $el.find('.apos-save,[data-save]').removeClass('apos-busy');
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
    // For this form we want a normal form submission and a new page to load.
    if (options.naturalSubmit) {
      return true;
    }
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
    apos.globalBusy(true);
    options.init(function(err) {
      apos.globalBusy(false);
      if (err) {
        hideModal();
        return;
      }

      // Anytime we load new markup for a modal, it's appropriate to
      // offer an opportunity for progressive enhancement of controls,
      // for instance via selectize
      apos.emit('enhance', $el);

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
        offset = Math.max($('.apos-admin-bar').height(),130);
      } else {
        offset = 100;
      }
      $el.offset({ top: $(window).scrollTop() + offset, left: ($(window).width() - $el.outerWidth()) / 2 });
      $el.show();
      // Give the focus to the first form element. (Would be nice to
      // respect tabindex if it's present, but it's rare that
      // anybody bothers)

      // If we don't have a select element first - focus the first input.
      // We also have to check for a select element within an array as the first field.
      if ($el.find("form:not(.apos-filter) .apos-fieldset:first.apos-fieldset-selectize, form:not(.apos-filter) .apos-fieldset:first.apos-fieldset-array .apos-fieldset:first.apos-fieldset-selectize").length === 0 ) {
        $el.find("form:not(.apos-filter) .apos-fieldset:not([data-extra-fields-link]):first :input:visible:enabled:first").focus();
      }
    });
  });

  return $el;
};

// This is the generic notification API
apos.notification = function(content, options) {
  var options = options || {};
  if (options.dismiss === true) { options.dismiss = 10; }
  var $notification = apos.fromTemplate($('[data-notification].apos-template'));
  if (options.type) {
    $notification.addClass('apos-notification--' + options.type);
  }
  if (options.dismiss) {
   $notification.attr('data-notification-dismiss', options.dismiss);
  }
  $notification.find('[data-notification-content]').text(content);

  // send it over to manager
  apos.notificationManager($notification);
}

apos.notificationManager = function($n) {
  var self = this;
  $notificationContainer = $('[data-notification-container]');
  // we're getting here because we have at least one notification coming up.
  // make sure DOM is ready for it

  self.ready = function() {
    $notificationContainer.addClass('apos-notification-container--ready');
    $notificationContainer.on('transitionend', function(e) {
      if (e.target.className == "apos-notification-container apos-notification-container--ready") {
        $notificationContainer.append('<br/>');
        self.addNotification($n);
      }
    });
  }

  self.removeNotification = function($n) {
    $n.removeClass('apos-notification--fired');
    $n.on('transitionend', function() {
      $n.remove();
    });
  }

  self.addNotification = function($n) {
    $notificationContainer.append($n);
    $n.fadeIn();

    setTimeout(function() {
      $n.addClass('apos-notification--fired');
      if ($n.attr('data-notification-dismiss')) {
        setTimeout(function() {
          self.removeNotification($n)
        }, $n.attr('data-notification-dismiss') * 1000);
      }
    }, 100);

    $n.on('click', '[data-notification-close]', function() {
      self.removeNotification($n);
    });
  }



  if ($notificationContainer.children().length === 0) {
    self.ready();
  } else {
    self.addNotification($n);
  }
}


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
      if (!matches) {
        return '';
      }
      return matches[1] + ':' + matches[2];
    }
  } else {
    matches = time.match(/^(\d+):(\d+)(:(\d+))?$/);
    if (!matches) {
      return '';
    }
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

// Do something after control returns to the browser (after
// you return from whatever event handler you're in). In old
// browsers the setTimeout(fn, 0) technique is used. In the
// latest browsers setImmediate is used, because it's
// faster (although it has a confusing name).
//
// May also be called with two arguments, `after` and `fn`.
// If `after` is false, fn is called immediately. Otherwise
// fn is called later as described above.

apos.afterYield = function(fn) {
  var after = true;
  if (arguments.length === 2) {
    fn = arguments[1];
    after = arguments[0];
  }
  if (!after) {
    return fn();
  }
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

  apos.globalBusy(true);

  $.jsonCall('/apos/upgrade-scene',
    {
      from: apos.scene,
      to: scene
    },
    function(result) {
      if ((!result) || (result.status !== 'ok')) {
        apos.globalBusy(false);
        return callback('error');
      }
      if (result.css.length) {
        $("<style>" + result.css + "</style>").appendTo('head');
      }
      if (result.html.length) {
        $('body').append(result.html);
      }
      $('body').one('aposSceneChange', function(e, scene) {
        apos.globalBusy(false);
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

// This is now mainly relevant for the "apply" feature and other situations
// where login does not involve a hard page refresh. For bc reasons we
// should not remove it in any case in the 0.5.x series. -Tom

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

// Status of the shift key. Automatically updated.
apos.shiftActive = false;

// Extend selectize to initiate select options on startup.
// This will allow us to show fields from the default value
$.extend(Selectize.prototype, {
    superSetup: Selectize.prototype.setup,
    setup: function() {
        this.superSetup();
        this.refreshOptions(false);
    }
});

apos.on('enhance', function($el) {
  // Selectize - Single Select
  $el.find('select[data-selectize]:not(.apos-template select[data-selectize], [select="multiple"])').selectize({
    create: false,
    // sortField: 'text',
    dataAttr: 'data-extra',
    searchField: ['label', 'value'],
    valueField: 'value',
    labelField: 'label',

    // We need to render custom templates to include our data-extra fields.
    //
    // If you need to include extra fields on a select option
    // format a JSON string in 'data-extra' like this:
    //
    // <option data-extra='{ "myField": "thing" }' > Label </option>
    //
    // -matt
    render: {
      item: function(data) {
        var attrs = ' data-value="'+data.value+'"';
        for (key in _.omit(data, ['value', 'label', '$order'])) {
          attrs = attrs + ' data-' + key + '="' + data[key] + '"';
        }
        return '<div data-selected ' + attrs + ' class="item">' + data.label + '</div>';
      },
      option: function(data) {
        var attrs = 'data-value="'+data.value+'"';
        for (key in _.omit(data, ['value', 'label', '$order'])) {
          attrs = attrs + ' data-' + key + '="' + data[key] + '"';
        }
        return '<div data-selectable ' + attrs + ' class="option">' + data.label + '</div>';
      }
    }
  });

  // Selectize - Multi Select
  $el.find('select[data-selectize][select="multiple"]:not(.apos-template select[data-selectize])').selectize({
    maxItems: null,
    delimiter: ', ',
  });

});

// Search for a tab and activate it, within the set of tabs
// that encloses $el (which may be $el itself). A set of tabs
// is currently identified by the apos-modal-tabs CSS class.
// Tab buttons have a data-tab attribute, which matches
// the data-tab-id attribute of a tab.

apos.activateTab = function($el, tabId) {
  $el.closest('.apos-modal-tabs').find('.apos-active').removeClass('apos-active');
  $el.closest('.apos-modal-tabs').find('[data-tab-id="' + tabId + '"]').addClass('apos-active');
  $el.closest('.apos-modal-tabs').find('[data-tab="' + tabId + '"]').addClass('apos-active');
};

// Everything in this DOMready block must be an event handler
// on 'body', optionally filtered to apply to specific elements,
// so that it can work on elements that don't exist yet.

$(function() {
  // Enable toggles. Note the use of $('body').on('click', 'selector'...)
  // to avoid problems with elements added later
  $('body').on('click', '.apos-accordion-title', function(event){
    // $(this).parent().find('.apos-accordion-items').toggleClass('open');
    var opened;
    if($(this).parent().hasClass('open')){
      opened = true;
    }
    $('body').trigger('aposCloseMenus');
    if (!opened){
      $(this).parent().toggleClass('open');
      $('.apos-admin-bar').addClass('item-open');
    }

    //$(this).parent().siblings().removeClass('open');
  });

  // power-user modal login
  $('body').on('keydown', function(e) {
    if (apos.shiftActive === true && e.keyCode === 27) {
      if (apos.data.user) {
        apos.modalFromTemplate($('.apos-modal-logout'), { naturalSubmit: true });
      } else {
        apos.modalFromTemplate($('.apos-modal-login'), { naturalSubmit: true });
      }
    }
  })

  $('body').on('click', '.apos-preview-toggle', function(event){
    $('.apos-preview-toggle').toggleClass('previewing');
    $('body').toggleClass('previewing');
  });

  // Close menus when an item is picked please!
  $('body').on('click', '.apos-accordion-items .apos-control', function() {
    $('body').trigger('aposCloseMenus');
  });

  //Call for when media or tag editor is opened
  $('body').on('click', '.apos-admin-bar-item > .apos-button', function(){
    $('.apos-admin-bar').addClass('item-open');
    $('body').trigger('aposCloseMenus');
  });

  $('body').on('aposCloseMenus', function(){
    $('.apos-admin-bar-item').removeClass('open');
    $('.apos-admin-bar').removeClass('item-open');
  });

  //sets up listeners for tabbed modals
  $('body').on('click', '.apos-modal-tab-title', function() {
    apos.activateTab($(this), $(this).attr('data-tab'));
  });

  // Progressively enhance all elements present on the page at DOMready
  apos.emit('enhance', $('body'));

  // If the aposAfterLogin cookie is set and we are logged in,
  // clear the cookie and redirect as appropriate.

  apos.afterLogin();

  // If the URL ends in #skipdown, locate the element with the
  // attribute data-skip-down-to and scroll to it, then remove
  // #skipdown from the URL. Useful for "poor man's AJAX" situations
  // where a page refresh is needed but you don't want the user to
  // be forced to scroll past the logo, etc. again.

  if (document.location.hash === '#skipdown') {
    document.location.hash = '';
    // slice off the remaining '#' in modern browsers
    if (window.history && (typeof window.history.replaceState === 'function')) {
      history.replaceState({}, '', window.location.href.slice(0, -1));
    }
    // Must yield first or this has no effect in Chrome.
    apos.afterYield(function() {
      $('html, body').scrollTop($('[data-skip-down-to]').offset().top - 50);
    });
  }

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

apos.enableShift = function() {
  $body = $('body');
  $body.keydown(function(e) {
    if (e.keyCode === 16) {
      apos.shiftActive = true;
      apos.emit('shiftDown', e);
    }
  });

  $body.keyup(function(e) {
    if (e.keyCode === 16) {
      apos.shiftActive = false;
      apos.emit('shiftUp', e);
    }
  });
};

apos.prefixAjax = function(prefix) {
  // If Apostrophe has a global URL prefix, patch
  // jQuery's AJAX capabilities to prepend that prefix
  // to any non-absolute URL

  if (prefix) {
    $.ajaxPrefilter(function(options, originalOptions, jqXHR) {
      if (options.url) {
        if (!options.url.match(/^[a-zA-Z]+:/))
        {
          options.url = prefix + options.url;
        }
      }
      return;
    });
  }
};

// Redirect correctly to the given location on the
// Apostrophe site, even if the prefix option is in use
// (you should provide a non-prefixed path)

apos.redirect = function(slug) {
  var href = apos.data.prefix + slug;
  if (href === window.location.href) {
    window.location.reload();
  } else {
    window.location.href = href;
  }
};

apos._globalBusyCounter = 0;

// If state is true, the interface changes to
// indicate Apostrophe is busy loading a modal
// dialog or other experience that preempts other
// activities. If state is false, the interface
// is unlocked. Calls may be nested and the
// interface will not unlock until all
// locks are released.
//
// See also apos.busy for interactions that
// only need to indicate that one particular
// element is busy.

apos.globalBusy = function(state) {
  if (state) {
    apos._globalBusyCounter++;
    if (apos._globalBusyCounter === 1) {
      // Newly busy
      lock();
    }
  } else {
    apos._globalBusyCounter--;
    if (!apos._globalBusyCounter) {
      // newly free
      unlock();
    }
  }
  function lock() {
    var $freezer = $('<div class="apos-global-busy"></div>');
    $('body').append($freezer);
  }
  function unlock() {
    $('.apos-global-busy').remove();
  }
};

$(function() {
  // Do these late so that other code has a chance to override
  apos.afterYield(function() {
    apos.enableShift();
  });
});
