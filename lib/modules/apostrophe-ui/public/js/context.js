// A base class with convenience methods for modals and other types that
// have an action and optionally a jquery element (self.$el). Your
// subclass is responsible for setting self.$el in its constructor if
// you wish to use methods that expect it, such as self.link. The
// other methods just expect options.action to be present.
//
// Also takes care of setting self.options and self.action for you.

apos.define('apostrophe-context', {

  beforeConstruct: function(self, options) {
    self.options = options;
    self.action = self.options.action;
  },

  construct: function(self, options) {

    // If an element with a `[data-verb-object]`
    // attribute is clicked, invoke `fn` method
    // with the jquery element clicked upon, and the
    // value of the attribute.  Mixed case
    // in `verb` and `object` is converted to
    // hyphenation before adding the click handler.
    //
    // Can also be called with just (verb, fn)
    // if you are just looking for `[data-verb]`.
    //
    // Event propagation and the default behavior of
    // the click event are both automatically stopped.
    //
    // Your subclass must set self.$el to use this method.
    //
    // The word "object" refers to "the object of the sentence."
    // It is a STRING, not a javascript object. -Tom and Joel

    self.link = function(verb, object, fn) {
      if (arguments.length === 2) {
        fn = object;
        object = null;
      }

      // If the controls for this element have been moved into another element
      // self.link can still find them

      if (self.$controls && (!(self.$el.find(self.$controls).length))) {
        apos.ui.link(self.$controls, verb, object, fn);
      }

      apos.ui.link(self.$el, verb, object, fn);

    };

    // Invoke $.jsonCall with the URL
    // self.action + '/' + verb.
    //
    // "options" and "failure" may be omitted entirely.
    //
    // Typical example:
    //
    // self.api('update', { age: 50 }, function(result) {
    //   if (result.status === 'ok') { ... }
    // });
    //
    // See $.jsonCall for details.

    self.api = function(verb, data, options, success, failure) {
      var args = Array.prototype.slice.call(arguments);
      args[0] = self.action + '/' + verb;
      return $.jsonCall.apply($, args);
    };

    // Invoke $.jsonCall with the URL self.action + '/' + verb
    // and always add { dataType: 'html' } to the options. For
    // fetching HTML fragments asynchronously. Since $.jsonCall
    // is always POST, there is no limit to the size of the
    // data object and no risk of a stale cached result coming back.
    //
    // Typical example:
    //
    // self.html('editor', { _id: 5555 }, function(html) {
    //   self.$editorDiv.html(html);
    // }, function() {
    //   alert('An error occurred');
    // });
    //
    // See $.jsonCall for details.

    self.html = function(verb, options, data, success, failure) {
      if (typeof(data) === 'function') {
        // No options argument passed, shift the others over
        failure = success;
        success = data;
        data = options;
        options = undefined;
      }
      var _options = {};
      if (options) {
        _.extend(_options, options);
      }
      _options.dataType = 'html';
      return $.jsonCall(self.action + '/' + verb, _options, data, success, failure);
    };
  }

});
