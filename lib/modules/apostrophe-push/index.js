var _ = require('lodash');

module.exports = {

  alias: 'push',

  construct: function(self, options) {

    // Make a browserCall method available on every request object,
    // which is called like this:
    //
    // req.browserCall('my.browserSide.method(?, ?)', arg1, arg2, ...)
    //
    // Each ? is replaced by a properly JSON-encoded version of the
    // next argument.
    //
    // If you need to pass the name or part of the name of a
    // function dynamically, you can use @ to pass an argument
    // literally:
    //
    // req.browserCall('new @(?)', 'MyConstructor', { options... })
    //
    // These calls can be returned as a single block of browser side
    // js code by invoking:
    //
    // req.getBrowserCalls()
    //
    // Apostrophe automatically does this in renderPage().
    //
    // The req object is necessary because the context for these
    // calls is a single page request. You will typically invoke
    // this from a route function, a page loader, or middleware.
    //
    // See below for a way to push the same call
    // on EVERY request, for various classes of users.

    self.apos.app.request.browserCall = function(pattern) {
      var req = this;
      if (!req.aposBrowserCalls) {
        req.aposBrowserCalls = [];
      }
      // Turn arguments into a real array https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Functions_and_function_scope/arguments
      var args = Array.prototype.slice.call(arguments);
      req.aposBrowserCalls.push({
        pattern: pattern,
        arguments: args.slice(1)
      });
    };

    // Make a getBrowserCalls method available on every request object,
    // which returns JavaScript to implement the browser-side
    // JavaScript calls that have been queued via calls to
    // req.pushCall(pattern, args...)

    self.apos.app.request.getBrowserCalls = function(pattern) {
      var req = this;
      return self.getBrowserCallsBody(req.aposBrowserCalls || []);
    };

    self.browserCalls = {};

    // Push a browser side JS call that will be invoked "when"
    // a particular situation applies. Currently `always` and
    // `user` (a logged in user is present) are supported. Any
    // `@`s and `?`s in `pattern` are replaced with the remaining arguments
    // after `when`. `@` arguments appear literally (useful for
    // constructor names) while `?` arguments are JSON-encoded.
    //
    // Example:
    // `apos.push.browserCall('user', 'myObject.addType(?)', typeObject)`

    self.browserCall = function(when, pattern /* , arg1, arg2... */) {
      if (arguments.length < 2) {
        throw new Error('apos.push.browserCall was invoked with only one argument.');
      }
      var args = Array.prototype.slice.call(arguments);
      if (!self.browserCalls[when]) {
        self.browserCalls[when] = [];
      }
      self.browserCalls[when].push({ pattern: pattern, arguments: args.slice(2) });
    };

    // A convenience wrapper for invoking apos.mirror
    // on the browser side, to ensure a client-side
    // moog type exists with the same class hierarchy
    // as the given object (usually a server-side module).
    //
    // You can think of this as just passing the object.__meta
    // object to apos.mirror on the browser side, although
    // we prune it to avoid revealing information about the
    // filesystem that doesn't matter on the browser side.
    //
    // `options` may be omitted. If `options.tool` is present,
    // it is appended to the type names being defined, after a hyphen.
    // This is useful to define related types, like `apostrophe-pieces-manager-modal`.
    // If an `options.substitute` object is present, the types names specified by
    // its keys are replaced with the corresponding values. Related types starting with
    // `my-` are also substituted without the need to separately specify that.

    self.browserMirrorCall = function(when, object, options) {

      var tool = options && options.tool;
      var substitute = (options && options.substitute) || {};

      var meta = {
        name: object.__meta.name + addSuffix(tool)
      };

      meta.chain = [];
      _.each(object.__meta.chain, function(entry) {
        var finalName;
        var baseName;
        if (entry.name.match(/^my\-/)) {
          var baseName = entry.name.replace(/^my\-/, '');
          var baseFinalName = substitute[baseName] || baseName;
          finalName = 'my-' + baseFinalName;
        } else {
          baseName = entry.name;
          finalName = substitute[baseName] || baseName;
        }
        meta.chain.push({ name: finalName + addSuffix(tool) });
      });

      return self.browserCall(when, 'apos.mirror(?)', meta);

      function addSuffix(tool) {
        if (!tool) {
          return '';
        }
        return '-' + tool;
      }
    };

    // Returns browser-side JavaScript to make the calls
    // queued up for the particular situation (`always`
    // or `user`).

    self.getBrowserCalls = function(when) {
      var s = self.getBrowserCallsBody(self.browserCalls[when] || []);
      return s;
    };

    // Part of the implementation of req.getBrowserCalls and
    // apos.push.getBrowserCalls.
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

    self.getBrowserCallsBody = function(calls) {
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

  }
};
