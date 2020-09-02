const _ = require('lodash');

module.exports = function(self, options) {

  return {

    // Emit an event from this module.
    //
    // This is an async function and must be awaited. It will
    // not complete until all of the event handlers
    // have resolved, in the order they were registered. Note that
    // event handlers do not have to be `async` functions unless
    // they `await` asynchronous things, like database queries.
    //
    // Any extra parameters passed after `name` are passed to
    // the event handlers as parameters, in the order given.
    //
    // See also the `on` method.

    async emit(name /* , arg1, arg2... */) {
      const args = Array.prototype.slice.call(arguments, 1);
      // Find the event handlers registered under the name
      // of the module doing the emitting, or its subclasses.

      // The apostrophe core object is an emitter but not a module, so
      // fake a chain for it.
      const chain = (self.__meta && self.__meta.chain) || [
        {
          name: 'apostrophe'
        }
      ];

      for (const entry of chain) {
        const handlers = self.apos.eventHandlers[entry.name] && self.apos.eventHandlers[entry.name][name];
        if (handlers) {
          for (const handler of handlers) {
            const module = self.apos.modules[handler.moduleName];
            const method = module[handler.methodName];
            // Although we have `self` it can't hurt to
            // supply the correct `this`
            await method.apply(module, args);
          }
        }
      }
    },

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

    on(name, methodName, fn) {
      let moduleName;
      let eventName;
      const index = name.indexOf(':');
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
      const eh = self.apos.eventHandlers[moduleName];
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
        self.apos.util.warn('The method ' + methodName + ' has been registered twice for the event\n' + eventName + ' in the module ' + self.__meta.name + '. It will only be called once.\n\nYou should rename the method in your code to differ from that in the module\nit extends so they both run.\n\nIf you are intentionally overriding it, assign a new function to\nself.' + methodName + ' instead.');
        return;
      }
      eh[eventName].push({
        moduleName: self.__meta.name,
        methodName: methodName
      });
    }

  };

};
