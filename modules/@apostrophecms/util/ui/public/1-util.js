// Adds minimal services to the apos object replacing
// functionality widget players can't live without,
// and provides the `runPlayers` method to run all players
// once if not run previously.
//
// Also schedules that method to run automatically when
// the DOM is ready.
//
// Adds apos to window if not already present.
//
// This is a lean, IE11-friendly implementation.

(function() {

  var apos = window.apos;
  apos.util = {};

  // emit a custom event on the specified DOM element in a cross-browser way.
  // If `data` is present, the properties of `data` will be available on the event object
  // in your event listeners. For events unrelated to the DOM, we often emit on
  // `document.body` and call `addEventListener` on `document.body` elsewhere.
  //
  // "Where is `apos.util.on`?" You don't need it, use `addEventListener`, which is
  // standard.

  apos.util.emit = function(el, name, data) {
    var event;
    try {
      // Modern. We can't sniff for this, we can only try it. IE11
      // has it but it's not a constructor and throws an exception
      event = new window.CustomEvent(name);
    } catch (e) {
      // bc for IE11
      event = document.createEvent('Event');
      event.initEvent(name, true, true);
    }
    apos.util.assign(event, data || {});
    el.dispatchEvent(event);
  };

  // Fetch the cookie by the given name
  apos.util.getCookie = function(name) {
    var match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match && match[2];
  };

  // Remove a CSS class, if present.
  // http://youmightnotneedjquery.com/

  apos.util.removeClass = function(el, className) {
    if (el.classList) {
      el.classList.remove(className);
    } else {
      el.className = el.className.replace(new RegExp('(^|\\b)' + className.split(' ').join('|') + '(\\b|$)', 'gi'), ' ');
    }
  };

  // Add a CSS class, if missing.
  // http://youmightnotneedjquery.com/

  apos.util.addClass = function(el, className) {
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

  apos.util.closest = function(el, selector) {
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
      if (!document.documentElement.contains(el)) {
        return null;
      }
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

  apos.util.assign = function(obj1, obj2 /*,  obj3... */) {
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
  // window.apos.util.widgetPlayers['widget-name'] = function(el, data, options) {}
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

  apos.util.widgetPlayers = {};

  // Run the given function whenever the DOM has new changes that
  // may require attention. For instance, we use this function to
  // schedule apos.util.runPlayers to run widget player code for
  // widgets that are new in the DOM. The passed function will be
  // called when the DOM is ready on initial page load, and also
  // when the main content area has been refreshed by the editor.

  apos.util.onReadyAndRefresh = function(fn) {
    onReady(fn);
    apos.bus && apos.bus.$on('refreshed', fn);
    function onReady(fn) {
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
  // `apos.util.widgetPlayers['apostrophe-images'] = function(el, data, options) { ... }`
  //
  // `el` is a DOM element, not a jQuery object. Otherwise identical to
  // traditional Apostrophe widget players. `data` contains the properties
  // of the widget itself, `options` contains the options that were
  // passed to it at the area or singleton level.
  //
  // Your player is guaranteed to run only once per widget. Hint:
  // DON'T try to find all the widgets. DO just enhance `el`.
  // This is a computer science principle known as "separation of concerns."

  apos.util.runPlayers = function(el) {
    const players = apos.util.widgetPlayers;
    const playerList = Object.keys(players);

    for (let i = 0; i < playerList.length; i++) {
      const playerOpts = players[playerList[i]];
      const playerEls = (el || document).querySelectorAll(playerOpts.selector);

      playerEls.forEach(function (el) {
        if (el.getAttribute('data-apos-played')) {
          return;
        }

        el.setAttribute('data-apos-played', true);

        playerOpts.player(el);
      });
    }
  };

  // Schedule runPlayers to run as soon as the document is ready, and also
  // when the page is partially refreshed by the editor.

  apos.util.onReadyAndRefresh(function() {
    apos.util.runPlayers();
  });

  // Given an attachment field value,
  // return the file URL. If options.size is set, return the URL for
  // that size (one-sixth, one-third, one-half, two-thirds, full, max).
  // full is "full width" (1140px), not the original.
  //
  // If you don't pass the options object, or options does not
  // have a size property, you'll get the URL of the original.
  // IMPORTANT: FOR IMAGES, THIS MAY BE A VERY LARGE FILE, NOT
  // WHAT YOU WANT. Set `size` appropriately!
  //
  // You can also pass a crop object (the crop must already exist).

  apos.util.attachmentUrl = function(file, options) {
    var path = apos.uploadsUrl + '/attachments/' + file._id + '-' + file.name;
    if (!options) {
      options = {};
    }
    // NOTE: the crop must actually exist already, you can't just invent them
    // browser-side without the crop API ever having come into play. If the
    // width is 0 the user hit save in the cropper without cropping, use
    // the regular version
    var crop;
    if (options.crop && options.crop.width) {
      crop = options.crop;
    } else if (file.crop && file.crop.width) {
      crop = file.crop;
    }
    if (crop) {
      path += '.' + crop.left + '.' + crop.top + '.' + crop.width + '.' + crop.height;
    }
    var effectiveSize;
    if ((!options.size) || (options.size === 'original')) {
      effectiveSize = false;
    } else {
      effectiveSize = options.size;
    }
    if (effectiveSize) {
      path += '.' + effectiveSize;
    }
    return path + '.' + file.extension;
  };

  // Returns true if the uri references the same site (same host and port) as the
  // current page. Cross-browser implementation, valid at least back to IE11.
  // Regarding port numbers, this will match as long as the URIs are consistent
  // about not explicitly specifying the port number when it is 80 (HTTP) or 443 (HTTPS),
  // which is generally the case.

  apos.util.sameSite = function(uri) {
    var matches = uri.match(/^(https?:)?\/\/([^/]+)/);
    if (!matches) {
      // If URI is not absolute or protocol-relative then it is always same-origin
      return true;
    }
    return window.location.host === matches[2];
  };
})();
