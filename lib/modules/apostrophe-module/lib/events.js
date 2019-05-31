var Promise = require('bluebird');
var _ = require('@sailshq/lodash');

module.exports = function(self, options) {
  // Emit an event from this module. Returns a promise.
  //
  // The promise will not resolve until all of the event handlers
  // have resolved, in the order they were registered. Note that
  // it is OK for event handlers to return a simple value rather
  // than a promise, in which case they resolve immediately.
  //
  // Any extra parameters passed after `name` are passed to
  // the event handlers as parameters, in the order given.
  //
  // See the `on` method.

  self.emit = function(name /* , arg1, arg2... */) {
    var args = Array.prototype.slice.call(arguments, 1);
    var eh = self.apos.eventHandlers[self.__meta.name] || {};
    return Promise.mapSeries(eh[name] || [], function(h) {
      var module = self.apos.modules[h.moduleName];
      var method = module[h.methodName];
      return method.apply(module, args);
    });
  };

  // For safe use inside the apostrophe core, which has a legacy emit
  // method (TODO remove legacy emit method in 3.x)
  self.promiseEmit = self.emit;

  // Register an event handler method in this module. The
  // given method name will be invoked when the given event
  // name is emitted with `emit`. As a shortcut, you may
  // optionally pass a function as a third argument. That
  // function becomes a method of your module called `methodName`.
  // This is exactly the same as defining it the normal way.
  //
  // Your method may return a promise. If it does, the next
  // event handler method will not begin running until your
  // promise resolves. If your promise rejects, the chain
  // stops and the promise returned by the `emit` method
  // also rejects.
  //
  // "What about events of other modules?" Register them
  // with this `name` syntax: `module-name:methodName`. This is
  // similar to the "cross-module includes" syntax used
  // elsewhere in Apostrophe.
  //
  // "Why do I need a method name? Why not a function alone?"
  // It should always be possible for subclasses to intentionally
  // override or extend your method via the `super` pattern.
  //
  // "Why can't I use a methodName that is identical to
  // the event name?" Doing so sets you up for an accidental
  // collision with other event handlers in subclasses.
  // Your method name should describe what your method does
  // in response to the event.

  self.on = function(name, methodName, fn) {
    var moduleName, eventName, index;
    index = name.indexOf(':');
    if ((typeof methodName) !== 'string') {
      throw new Error('When registering an Apostrophe module event handler, the second argument must be a method name, not a function. This ensures that event handlers can be overwritten and/or extended with the "super" pattern.');
    }
    if (index === -1) {
      moduleName = self.__meta.name;
      eventName = name;
    } else {
      moduleName = name.substr(0, index);
      eventName = name.substr(index + 1);
    }
    if (_.camelCase(eventName) === _.camelCase(methodName)) {
      throw new Error('The method name ' + methodName + ' is essentially identical to the event name, ' + eventName + '. To prevent conflicts with other handlers, you must give it a distinct name expressing what it actually does with the event.');
    }
    self.apos.eventHandlers[moduleName] = self.apos.eventHandlers[moduleName] || {};
    var eh = self.apos.eventHandlers[moduleName];
    if (fn) {
      self[methodName] = fn;
    }
    eh[eventName] = eh[eventName] || [];
    if (_.find(eh[eventName], function(item) {
      return (item.moduleName === self.__meta.name) && (item.methodName === methodName);
    })) {
      // The "event name and method name must differ" rule helps
      // prevent this situation, but it is still possible and a
      // warning is in order
      self.apos.utils.warn('The method ' + methodName + ' has been registered twice for the event\n' + eventName + ' in the module ' + self.__meta.name + '. It will only be called once.\n\nYou should rename the method in your code to differ from that in the module\nit extends so they both run.\n\nIf you are intentionally overriding it, assign a new function to\nself.' + methodName + ' instead.');
      return;
    }
    eh[eventName].push({ moduleName: self.__meta.name, methodName: methodName });
  };

  // Invoke a callAll method *and* emit a new-style promise event. `callAll` is invoked first,
  // and if its callback does not receive an error, `emit` is invoked. When the promise
  // returned by `emit` resolves, the final callback is invoked. A promise interface
  // is not provided here because this method should only be used to migrate away from
  // legacy `callAll` invocations. New code should always emit a promise event and
  // avoid `callAll`.

  self.callAllAndEmit = function(callAllName, eventName, /* argument, ... */ callback) {
    var _callback = arguments[arguments.length - 1];
    var remainder = Array.prototype.slice.call(arguments, 2, arguments.length - 1);
    var args = [ callAllName ].concat(remainder);
    args.push(function(err) {
      if (err) {
        // See: http://goo.gl/rRqMUw
        _callback(err);
        return null;
      }
      return self.promiseEmit.apply(self, [ eventName ].concat(remainder)).then(function() {
        // See: http://goo.gl/rRqMUw
        _callback(null);
        return null;
      }).catch(function(err) {
        _callback(err);
        // Silence well-meaning warnings, we did handle the error,
        // via the callback
        return null;
      });
    });
    return self.apos.callAll.apply(self.apos, args);
  };
};
