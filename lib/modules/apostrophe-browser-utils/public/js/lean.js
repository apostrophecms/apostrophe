// Adds minimal services to the apos object replacing
// functionality widget players can't live without,
// and provides the `runPlayers` method to run all players
// once if not run previously.
//
// Also schedules that method to run automatically when
// the DOM is ready.
//
// Adds apos to window if not already present.

/* eslint-env browser */

(function() {

  window.apos = window.apos || {};
  var apos = window.apos;

  apos.utils = apos.utils || {};

  // Make a POST JSON call to the given URI, which is expected to be on the
  // Apostrophe site. CSRF headers are correctly sent and the URL is modified
  // if needed to honor the site prefix.
  //
  // The object `data` is transferred as JSON. On success the response is
  // delivered to the callback as `(null, response)`, following the Node.js convention.
  // On failure the error is delivered as `(err)`. Specifically the
  // error will be the event object associated with the error.
  //
  // If `data` is a FormData object, a standard multipart/form-data upload occurs
  // and JSON encoding is not used. This enables multipart/form-data uploads
  // that respect Apostrophe's CSRF token and prefix.
  //
  // If a browser error (status 400 or above) is reported, the
  // object passed as the error will have a `status` property that
  // can be inspected. The actual data of the error response is still
  // delivered as well, in the second argument.

  apos.utils.post = function(uri, data, callback) {
    if (apos.prefix) {
      uri = apos.prefix + uri;
    }
    var formData = window.FormData && (data instanceof window.FormData);
    var xmlhttp = new XMLHttpRequest();
    var csrfToken = apos.csrfCookieName ? apos.utils.getCookie(apos.csrfCookieName) : 'csrf-fallback';
    xmlhttp.open("POST", uri);
    if (!formData) {
      xmlhttp.setRequestHeader('Content-Type', 'application/json');
    }
    if (csrfToken) {
      xmlhttp.setRequestHeader('X-XSRF-TOKEN', csrfToken);
    }
    if (formData) {
      xmlhttp.send(data);
    } else {
      xmlhttp.send(JSON.stringify(data));
    }
    monitor(xmlhttp, callback);
  };

  // Like `apos.utils.post` but uses a GET request, with the properties of `data`
  // added with query string encoding. Currently no support for nested properties
  // in `data`; intended for simple cases where you actually want the browser
  // to cache. Like `jsonCall`, it invokes the callback Node.js style,
  // with an error if any, followed by the response as parsed JSON.
  //
  // If a browser error (status 400 or above) is reported, the
  // object passed as the error will have a `status` property that
  // can be inspected. The actual data of the error response is still
  // delivered as well, in the second argument.

  apos.utils.get = function(uri, data, callback) {
    if (apos.prefix) {
      uri = apos.prefix + uri;
    }
    uri += '?';
    var keys = Object.keys(data);
    var i;
    for (i = 0; (i < keys.length); i++) {
      if (i > 0) {
        uri += '&';
      }
      uri += encodeURIComponent(keys[i]) + '=' + encodeURIComponent(data[keys[i]]);
    }
    var xmlhttp = new XMLHttpRequest();
    xmlhttp.open("GET", uri);
    xmlhttp.setRequestHeader("Content-Type", "application/json");
    xmlhttp.send(JSON.stringify(data));
    monitor(xmlhttp, callback);
  };

  // Fetch the cookie by the given name
  apos.utils.getCookie = function(name) {
    var match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match && match[2];
  };

  // Implementation detail of `apos.utils.post` and `apos.utils.get`
  function monitor(xmlhttp, callback) {
    xmlhttp.addEventListener("load", function() {
      var responseHeader = this.getResponseHeader("Content-Type");
      var trimResponse = this.responseText.trim();
      var data;
      if (responseHeader.match(/^application\/json/)) {
        // Definitely JSON, treat as such
        try {
          data = JSON.parse(this.responseText);
        } catch (e) {
          return callback(e);
        }
      } else {
        // Still try to treat as JSON if it looks like it
        // might be, but fall back to accepting it as-is
        if (maybeJson(trimResponse)) {
          try {
            data = JSON.parse(this.responseText);
          } catch (e) {
            data = this.responseText;
          }
        } else {
          data = this.responseText;
        }
      }
      return callback(null, data);
    });
    xmlhttp.addEventListener('abort', function(evt) {
      return callback(evt);
    });
    xmlhttp.addEventListener('error', function(evt) {
      return callback(evt);
    });
  };

  function maybeJson (json) {
    if (typeof json !== 'string') {
      return false;
    }
    var cases = [ 'true', 'false', 'null', '"', '-', '[', '{', '.' ];
    return cases.some(function(oneCase) {
      return json.substring(0, oneCase.length) === oneCase;
    });
  }

  // Remove a CSS class, if present.
  // http://youmightnotneedjquery.com/

  apos.utils.removeClass = function(el, className) {
    if (el.classList) {
      el.classList.remove(className);
    } else {
      el.className = el.className.replace(new RegExp('(^|\\b)' + className.split(' ').join('|') + '(\\b|$)', 'gi'), ' ');
    }
  };

  // Add a CSS class, if missing.
  // http://youmightnotneedjquery.com/

  apos.utils.addClass = function(el, className) {
    if (el.classList) {
      el.classList.add(className);
    } else {
      el.className += ' ' + className;
    }
  };

  // A wrapper for the native closest() method of DOM elements,
  // where available, otherwise a polyfill for IE9+. Returns the
  // closest ancestor of el that matches selector, where
  // el itself is considered the closest possible ancestor.

  apos.utils.closest = function(el, selector) {
    if (el.closest) {
      return el.closest(selector);
    }
    // Polyfill per https://developer.mozilla.org/en-US/docs/Web/API/Element/closest
    if (!Element.prototype.matches) {
      Element.prototype.matches = Element.prototype.msMatchesSelector ||
        Element.prototype.webkitMatchesSelector;
    }
    Element.prototype.closest = function(s) {
      var el = this;
      if (!document.documentElement.contains(el)) return null;
      do {
        if (el.matches(s)) {
          return el;
        }
        el = el.parentElement || el.parentNode;
      } while (el !== null && el.nodeType === 1);
      return null;
    };
    return el.closest(selector);
  };

  // Like Object.assign. Uses Object.assign where available.
  // (Takes us back to IE9)

  apos.utils.assign = function(obj1, obj2 /*,  obj3... */) {
    if (Object.assign) {
      return Object.assign.apply(Object, arguments);
    }
    var i, j, keys, key;
    for (i = 1; (i < arguments.length); i++) {
      keys = Object.keys(arguments[i]);
      for (j = 0; (j < keys.length); j++) {
        key = keys[j];
        obj1[key] = arguments[i][key];
      }
    }
    return obj1;
  };

  // Map of widget players. Adding one is as simple as:
  // window.apos.utils.widgetPlayers['widget-name'] = function(el, data, options) {}
  //
  // Use the widget's name, like "apostrophe-images", NOT the name of its module.
  //
  // Your player receives the DOM element of the widget and the
  // pre-parsed `data` and `options` objects associated with it,
  // as objects. el is NOT a jQuery object, because jQuery is not pushed
  // (we push no libraries in the lean world).
  //
  // Your player should add any needed javascript effects to
  // THAT ONE WIDGET and NO OTHER. Don't worry about finding the
  // others, we will do that for you and we guarantee only one call per widget.

  apos.utils.widgetPlayers = {};

  // On DOMready, similar to jQuery. Always defers at least to next tick.
  // http://youmightnotneedjquery.com/

  apos.utils.onReady = function(fn) {
    if (document.readyState !== 'loading') {
      setTimeout(fn, 0);
    } else if (document.addEventListener) {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      document.attachEvent('onreadystatechange', function() {
        if (document.readyState !== 'loading') {
          fn();
        }
      });
    }
  };

  // Run all the players that haven't been run. Invoked for you at DOMready
  // time. You may also invoke it if you just AJAXed in some content and
  // have reason to suspect there could be widgets in there. You may pass:
  //
  // * Nothing at all - entire document is searched for new widgets to enhance, or
  // * A DOM element - new widgets to enhance are found within this scope only.
  //
  // To register a widget player for the `apostrophe-images` widget, write:
  //
  // `apos.utils.widgetPlayers['apostrophe-images'] = function(el, data, options) { ... }`
  //
  // `el` is a DOM element, not a jQuery object. Otherwise identical to
  // traditional Apostrophe widget players. `data` contains the properties
  // of the widget itself, `options` contains the options that were
  // passed to it at the area or singleton level.
  //
  // Your player is guaranteed to run only once per widget. Hint:
  // DON'T try to find all the widgets. DO just enhance `el`.
  // This is a computer science principle known as "separation of concerns."

  apos.utils.runPlayers = function(el) {
    var widgets = (el || document).querySelectorAll('[data-apos-widget]');
    var i;
    if (el && el.getAttribute('data-apos-widget')) {
      // el is itself a widget. Might still contain some too
      play(el);
    }
    for (i = 0; (i < widgets.length); i++) {
      play(widgets[i]);
    }

    function play(widget) {
      if (widget.getAttribute('data-apos-played')) {
        return;
      }
      var data = JSON.parse(widget.getAttribute('data'));
      var options = JSON.parse(widget.getAttribute('data-options'));
      widget.setAttribute('data-apos-played', '1');
      // bc with the old lean module
      var player = apos.utils.widgetPlayers[data.type] || (apos.lean && apos.lean.widgetPlayers && apos.lean.widgetPlayers[data.type]);
      if (!player) {
        return;
      }
      player(widget, data, options);
    }
  };

  // Schedule runPlayers to run as soon as the document is ready.
  // You can run it again with apos.utils.runPlayers() if you AJAX-load some widgets.

  apos.utils.onReady(function() {
    // Indirection so you can override `apos.utils.runPlayers` first if you want to for some reason
    apos.utils.runPlayers();
  });

  // In the event (cough) that we're in the full-blown Apostrophe editing world,
  // we also need to run widget players when content is edited
  if (apos.on) {
    apos.on('enhance', function($el) {
      apos.utils.runPlayers($el[0]);
    });
  }

})();
