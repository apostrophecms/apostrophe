/* jshint undef: true */
/* global $, _ */
/* global alert, prompt */

apos.synth = moog({});

_.extend(apos, {

  handlers: {},

  // EVENT HANDLING
  //
  // apos.emit(eventName, /* arg1, arg2, arg3... */)
  //
  // Emit an Apostrophe event. All handlers that have been set
  // with apos.on for the same eventName will be invoked. Any additional
  // arguments are received by the handler functions as arguments.
  //
  // CURRENT EVENTS
  //
  // 'enhance' is triggered to request progressive enhancement
  // of form elements newly loaded into the DOM (jQuery selectize).
  // It is typically used in admin modals.
  //
  // 'ready' is triggered when the main content area of the page
  // has been refreshed.

  emit: function(eventName /* ,arg1, arg2, arg3... */) {
    var handlers = apos.handlers[eventName];
    if (!handlers) {
      return;
    }
    var args = Array.prototype.slice.call(arguments, 1);
    var i;
    for (i = 0; (i < handlers.length); i++) {
      handlers[i].apply(window, args);
    }
  },

  // Install an Apostrophe event handler. The handler will be called
  // when apos.emit is invoked with the same eventName. The handler
  // will receive any additional arguments passed to apos.emit.

  on: function(eventName, fn) {
    apos.handlers[eventName] = (apos.handlers[eventName] || []).concat([ fn ]);
  },

  // Remove an Apostrophe event handler. If fn is not supplied, all
  // handlers for the given eventName are removed.
  off: function(eventName, fn) {
    if (!fn) {
      delete apos.handlers[eventName];
      return;
    }
    apos.handlers[eventName] = _.filter(apos.handlers[eventName], function(_fn) {
      return fn !== _fn;
    });
  },

  log: function(msg) {
    if (console && apos.log) {
      if (console.trace) {
        console.trace();
      }
      console.log(msg);
    }
  },

  // When apos.change('foo') is invoked, the following things happen:
  //
  // 1. apos.emit('change', 'foo') is invoked.
  //
  // 2. The main content area (the data-apos-refreshable div) is
  // refreshed via an AJAX request, without refreshing the entire page.
  //
  // This occurs without regard to the `what` parameter because there are
  // too many ways that the main content area can be influenced by any
  // change made via the admin bar. It's simplest to refresh the
  // entire content zone and still much faster than a page refresh.
  //
  // You can also pass a doc object as `what`, in which
  // case the `emit` call looks like:
  //
  // apos.emit('change', what.type, what)

  change: function(what) {
    var object;
    if (typeof(what) === 'object') {
      apos.emit('change', what.type, what);
    } else {
      apos.emit('change', what);
    }
    apos.ui.globalBusy(true);
    $.get(window.location.href, { apos_refresh: apos.utils.generateId() }, function(data) {
      apos.ui.globalBusy(false);
      // Make sure we run scripts in the returned HTML
      $('[data-apos-refreshable]').html($.parseHTML(data, document, true));
      $(function() {
        setImmediate(function() {
          apos.emit('ready');
          apos.emit('enhance', $('[data-apos-refreshable]'));
        });
      });
    }).fail(function() {
      apos.ui.globalBusy(false);
    });
  },

  isDefined: apos.synth.isDefined,

  define: apos.synth.define,

  redefine: apos.synth.redefine,

  create: apos.synth.create,

  mirror: apos.synth.mirror,

  pageReady: function() {
    $(function() {
      setImmediate(function() {
        apos.emit("ready");
        apos.emit("enhance", $('body'));
      });
    })
  },

  // Angular-compatible. Send the csrftoken cookie as the X-CSRFToken header.
  // This works because if we're running via a script tag or iframe, we won't
  // be able to read the cookie.
  //
  // https://docs.angularjs.org/api/ng/service/$http#cross-site-request-forgery-xsrf-protection
  //
  // We use Angular's cookie name although CSRF is a more common spelling. -Tom

  csrf: function() {
    $.ajaxPrefilter(function(options, originalOptions, jqXHR) {
      var csrfToken = $.cookie('XSRF-TOKEN');
      jqXHR.setRequestHeader('X-XSRF-TOKEN', csrfToken);
    });
  },

  prefixAjax: function() {
    // If Apostrophe has a global URL prefix, patch
    // jQuery's AJAX capabilities to prepend that prefix
    // to any non-absolute URL

    if (apos.prefix) {
      $.ajaxPrefilter(function(options, originalOptions, jqXHR) {
        if (options.url) {
          if (!options.url.match(/^[a-zA-Z]+:/))
          {
            options.url = apos.prefix + options.url;
          }
        }
        return;
      });
    }
  }

});

