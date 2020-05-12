// This module provides ways to "push" JavaScript calls so that they happen in the
// web browser in a well-managed way.
//
// For calls that should happen for every page load, or for every logged-in page load,
// see the `browserCall` method of this module (`apos.push.browserCall`) as documented
// below.
//
// For calls that should happen only for a specific request (`req`), this module
// extends `req` with a `browserCall` method which takes exactly the same arguments
// as `apos.push.browserCall`, except that there is no `when` argument.
//
// Example:
//
// ```
// req.browserCall('apos.someModule.method(?, ?)', arg1, arg2, ...)
// ```
//
// Each `?` is replaced by a properly JSON-encoded version of the
// next argument.
//
// If you need to pass the name or part of the name of a
// function dynamically, you can use @ to pass an argument
// literally:
//
// ```
// req.browserCall('new @(?)', 'MyConstructor', { options... })
// ```

let _ = require('lodash');

module.exports = {
  options: { alias: 'push' },
  init(self, options) {

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
      let req = this;
      if (!req.aposBrowserCalls) {
        req.aposBrowserCalls = [];
      }
      // Turn arguments into a real array https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Functions_and_function_scope/arguments
      let args = Array.prototype.slice.call(arguments);
      req.aposBrowserCalls.push({
        pattern: pattern,
        arguments: args.slice(1)
      });
    };

    self.apos.app.request.browserModule = function(module, data) {
      this.browserCall('apos.modules[?] = ?', module.__meta.name, data);
      if (module.options.alias) {
        this.browserCall('apos[?] = apos.modules[?]', module.options.alias, module.__meta.name);
      }
    };

    // Make a getBrowserCalls method available on every request object,
    // which returns JavaScript to implement the browser-side
    // JavaScript calls that have been queued via calls to
    // req.pushCall(pattern, args...)

    self.apos.app.request.getBrowserCalls = function(pattern) {
      let req = this;
      return self.getBrowserCallsBody(req.aposBrowserCalls || []);
    };

    self.browserCalls = {};

  },
  methods(self, options) {

    return {
      
      // Push a browser side JS call that will be invoked "when"
      // a particular situation applies. Currently `always` and
      // `user` (a logged in user is present) are supported. Any
      // `@`s and `?`s in `pattern` are replaced with the remaining arguments
      // after `when`. `@` arguments appear literally (useful for
      // constructor names) while `?` arguments are JSON-encoded.
      //
      // Example:
      // `apos.push.browserCall('user', 'myObject.addType(?)', typeObject)`
      
      browserCall(when, pattern) {
        if (arguments.length < 2) {
          throw new Error('apos.push.browserCall was invoked with only one argument.');
        }
        let args = Array.prototype.slice.call(arguments);
        if (!self.browserCalls[when]) {
          self.browserCalls[when] = [];
        }
        self.browserCalls[when].push({
          pattern: pattern,
          arguments: args.slice(2)
        });
      },
      
      // Returns browser-side JavaScript to make the calls
      // queued up for the particular situation (`always`
      // or `user`).
      
      getBrowserCalls(when) {
        let s = self.getBrowserCallsBody(self.browserCalls[when] || []);
        return s;
      },
      
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
      
      getBrowserCallsBody(calls) {
        return _.map(calls, function (call) {
          let code = '  ';
          let pattern = call.pattern;
          let n = 0;
          let from = 0;
          while (true) {
            let qat = pattern.substr(from).search(/[?@]/);
            if (qat !== -1) {
              qat += from;
              code += pattern.substr(from, qat - from);
              if (pattern.charAt(qat) === '?') {
                // ? inserts an argument JSON-encoded
                try {
                  code += self.apos.templates.jsonForHtml(call.arguments[n++]);
                } catch (e) {
                  self.apos.utils.error(call.arguments);
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
          code += ';';
          return code;
        }).join('\n');
      }
    };
  },
  helpers(self, options) {
    return {
      // Invoke browser-side javascript calls published
      // via `req.browserCall` during the current request.
      // This is for use when you are implementing an AJAX refresh
      // of part of the page but you need the benefit of such calls
      // (for instance: @apostrophecms/places map calls).
      newBrowserCalls: function () {
        let req = self.apos.templates.contextReq;
        return self.apos.templates.safe('<script type="text/javascript">\n' + '  if (window.apos) {\n' + '    ' + req.getBrowserCalls() + '\n' + '  }\n' + '</script>\n');
      }
    };
  }
};  
