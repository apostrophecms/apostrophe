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
      console.log(msg);
    }
  },

  // When apos.change('blog') is invoked, the following things happen:
  //
  // 1. apos.emit('change', 'blog') is invoked.
  //
  // 2. The main content area (the data-apos-refreshable div) is
  // refreshed via an AJAX request, without refreshing the entire page.
  // This occurs without regard to the `what` parameter because there are
  // too many ways that the main content area can be influenced by any
  // change made via the admin bar. It's simplest to refresh the
  // entire content zone and still much faster than a page refresh.

  change: function(what) {
    apos.emit('change', what);
    $.get(window.location.href, { apos_refresh: apos.utils.generateId() }, function(data) {
      // Make sure we run scripts in the returned HTML
      $('[data-apos-refreshable]').html($.parseHTML(data, document, true));
      $(function() {
        setImmediate(function() {
          apos.emit('ready');
          apos.emit('enhance', $('[data-apos-refreshable]'));
        });
      });
    });
  },

  isDefined: apos.synth.isDefined,

  define: apos.synth.define,

  redefine: apos.synth.redefine,

  create: apos.synth.create,

  // mirror an existing class inheritance hierarchy
  // such as nifty-events : events : pieces. Adds "-"
  // and the given suffix to the name of each type
  // in the hierarchy; if no suffix is given, then
  // the original hierarchy is mirrored.
  //
  // This method is useful when a browser-side singleton
  // should have the same class hierarchy as the
  // server-side module. That way, any developer who
  // wishes to do so can define the intervening steps
  // directly, or skip it, and get the expected results.
  //
  // With a suffix, it allows things like "pieces-editor"
  // and "pieces-manager" to have a hierarchy that mirrors
  // that of the module.

  mirror: function(meta, suffix) {
    var lastName;
    _.each(meta.chain, function(type) {
      var name = type.name;
      if (suffix) {
        name += '-' + suffix;
      }
      if (!apos.isDefined(name)) {
        apos.define(name, {
          extend: lastName
        });
      }
      lastName = name;
    });
  },

  pageReady: function() {
    apos.log("pageReady");
    $(function() {
      setImmediate(function() {
        apos.emit("ready");
        apos.emit("enhance", $('body'));
      });
    })
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

