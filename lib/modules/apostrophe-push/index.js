var _ = require('lodash');

module.exports = {
  construct: function(self, options) {

    // Make a pushCall method available on every request object,
    // which is called like this:
    //
    // req.pushCall('my.browserSide.method(?, ?)', arg1, arg2, ...)
    //
    // Each ? is replaced by a properly JSON-encoded version of the
    // next argument.
    //
    // If you need to pass the name or part of the name of a
    // function dynamically, you can use @ to pass an argument
    // literally:
    //
    // req.pushCall('new @(?)', 'MyConstructor', { options... })
    //
    // These calls can be returned as a single block of browser side
    // js code by invoking:
    //
    // req.getCalls()
    //
    // Apostrophe automatically does this in renderPage().
    //
    // The req object is necessary because the context for these
    // calls is a single page request. You will typically invoke
    // this from a route function, a page loader, or middleware.
    //
    // See globalCallWhen for a way to push the same call
    // on EVERY request, for various classes of users.

    self.apos.app.request.pushCall = function(pattern) {
      var req = this;
      if (!req._aposCalls) {
        req._aposCalls = [];
      }
      // Turn arguments into a real array https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Functions_and_function_scope/arguments
      var args = Array.prototype.slice.call(arguments);
      req._aposCalls.push({
        pattern: pattern,
        arguments: args.slice(1)
      });
    };

    // Make a getCalls method available on every request object,
    // which returns JavaScript to implement the browser-side
    // JavaScript calls that have been queued via calls to
    // req.pushCall(pattern, args...)

    self.apos.app.request.getCalls = function(pattern) {
      var req = this;
      return self.getCallsBody(req._aposCalls || []);
    };

    self._globalCalls = {};

    // Push a browser side JS call that will be invoked "when"
    // a particular situation applies. Currently `always` and
    // `user` (a logged in user is present) are supported. Any
    // `@`s and `?`s in `pattern` are replaced with the remaining arguments
    // after `when`. `@` arguments appear literally (useful for
    // constructor names) while `?` arguments are JSON-encoded.
    //
    // Example:
    // `apos.push.globalCallWhen('user', 'myObject.addType(?)', typeObject)`

    self.globalCallWhen = function(when, pattern) {
      var args = Array.prototype.slice.call(arguments);
      if (!self._globalCalls[when]) {
        self._globalCalls[when] = [];
      }
      self._globalCalls[when].push({ pattern: pattern, arguments: args.slice(2) });
    };

    // Returns browser-side JavaScript to make the calls
    // queued up for the particular situation (`always`
    // or `user`).

    self.getGlobalCallsWhen = function(when) {
      var s = self.getCallsBody(self._globalCalls[when] || []);
      return s;
    };

    // Implement req.pushData().
    //
    // req.pushData() expects an object. The properties of this object are
    // merged recursively with the browser side apos.data object, using the
    // jQuery extend() method. You can make many calls, merging in more data,
    // and unspool them all
    // as a block of valid browser-ready javascript by invoking
    // req.getData().

    self.apos.app.request.pushData = function(datum) {
      var req = this;
      if (!req._aposData) {
        req._aposData = [];
      }
      req._aposData.push(datum);
    };

    // This method iterates over the data objects that have been pushed with
    // `getData` for the specified request and returns browser-side JavaScript code to set
    // that data as properties of `apos.data` object.

    self.apos.app.request.getData = function() {
      var req = this;
      return self.getDataBody(req._aposData || []);
    };

    self._globalData = [];

    // Make global settings such as apos.data.uploadsUrl available to the browser. You
    // can push more data by calling apos.pushGlobalData(). $.extend is used
    // to merge consecutive pushes that refer to the same parent elements. This
    // global data is returned as ready-to-run JS code EVERY TIME apos.getGlobalData()
    // is called. For data that is specific to a single request, see
    // req.pushData() and req.getData().

    self.globalData = function(datum) {
      self._globalData.push(datum);
    };

    // This method iterates over the data objects that have been pushed with
    // `getGlobalData` and returns browser-side JavaScript code to set
    // that data as properties of `apos.data` object.

    self.getGlobalData = function() {
      return self.getDataBody(self._globalData || []);
    };

    // Part of the implementation of req.getCalls and
    // apos.push.getGlobalCalls.
    //
    // Turn any number of call objects like this:
    // `[ { pattern: @.func(?), arguments: [ 'myFn', { age: 57 } ] } ]`
    //
    // Into javascript source code like this:
    //
    // `myFn.func({ age: 57 });`
    //
    // `... next call here ...`
    //
    // Suitable to be emitted inside a script tag.
    //
    // Note that `?` JSON-encodes an argument, while `@` inserts it literally.

    self.getCallsBody = function(calls) {
      return _.map(calls, function(call) {
        var code = '  ';
        var pattern = call.pattern;
        var n = 0;
        var from = 0;
        while (true) {
          var qat = pattern.substr(from).search(/[\?\@]/);
          if (qat !== -1) {
            qat += from;
            code += pattern.substr(from, qat - from);
            if (pattern.charAt(qat) === '?') {
              // ? inserts an argument JSON-encoded
              try {
                code += JSON.stringify(call.arguments[n++]);
              } catch (e) {
                console.error(call.arguments);
                throw e;
              }
            } else {
              // @ inserts an argument literally, unquoted
              code += call.arguments[n++];
            }
            from = qat + 1;
          } else {
            code += pattern.substr(from);
            break;
          }
        }
        code += ";";
        return code;
      }).join("\n");
    };

    // Implementation detail of `req.getData()` and
    // `apos.push.getGlobalData()`.

    self.getDataBody = function(data) {
      var code = '  apos.data = apos.data || {};\n';
      code += _.map(data, function(datum) {
        return '  $.extend(true, apos.data, ' + self.apos.templates.jsonForHtml(datum) + ');';
      }).join("\n");
      return code;
    };

    self.apos.push = self;
  }
};
