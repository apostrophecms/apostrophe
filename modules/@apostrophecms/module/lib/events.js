const _ = require('lodash');
const { SemanticAttributes } = require('@opentelemetry/semantic-conventions');

module.exports = function(self) {

  return {

    // Register an old event name to be accepted for a new event name.
    // If newName is emitted, oldName will be accepted as a synonym in handlers.
    // Currently supported for Apostrophe core module events only. Not to be
    // used for module-specific events. Call with just the event name,
    // not the `apostrophe:` part.
    aliasEvent(oldName, newName) {
      self.apos.eventAliases[`apostrophe:${oldName}`] = newName;
    },

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

    async emit(name, ...args) {
      // Find the event handlers registered under the name
      // of the module doing the emitting, or its subclasses.

      // The apostrophe core object is an emitter but not a module, so
      // fake a chain for it.
      const chain = (self.__meta && self.__meta.chain) || [
        {
          name: 'apostrophe'
        }
      ];

      const telemetry = self.apos.telemetry;

      // Create the "outer" span
      const moduleName = (self.__meta && self.__meta.name) || 'apostrophe';
      const spanEmitName = `event:${moduleName}:${name}`;
      await telemetry.startActiveSpan(spanEmitName, async (spanEmit) => {
        spanEmit.setAttribute(SemanticAttributes.CODE_FUNCTION, 'emit');
        spanEmit.setAttribute(SemanticAttributes.CODE_NAMESPACE, moduleName);
        spanEmit.setAttribute(telemetry.Attributes.EVENT_MODULE, moduleName);
        spanEmit.setAttribute(telemetry.Attributes.EVENT_NAME, name);

        for (const entry of chain) {
          const handlers = self.apos.eventHandlers[entry.name] && self.apos.eventHandlers[entry.name][name];
          if (handlers) {
            for (const handler of handlers) {

              // Create an active "inner" span for each handler using the parent as a context
              const spanHandlerName = spanEmitName + `:handler:${handler.moduleName}:${handler.handlerName}`;
              await telemetry.startActiveSpan(spanHandlerName, async (spanHandler) => {
                spanHandler.setAttribute(SemanticAttributes.CODE_FUNCTION, handler.handlerName);
                spanHandler.setAttribute(SemanticAttributes.CODE_NAMESPACE, handler.moduleName);
                spanHandler.setAttribute(telemetry.Attributes.EVENT_MODULE, moduleName);
                spanHandler.setAttribute(telemetry.Attributes.EVENT_NAME, name);

                try {
                  const module = self.apos.modules[handler.moduleName];
                  const fn = module.compiledHandlers[entry.name][name][handler.handlerName];
                  // Although we have `self` it can't hurt to
                  // supply the correct `this`
                  await fn.apply(module, args);
                  spanHandler.setStatus({ code: telemetry.api.SpanStatusCode.OK });
                  spanHandler.end();
                } catch (err) {
                  telemetry.handleError(spanHandler, err);
                  // Be sure to close the parent span as well
                  spanHandler.end();
                  spanEmit.end();
                  throw err;
                }
              }, spanEmit);
            }
          }
        }

        spanEmit.end();
      });
    },

    // You don't need to call this. It is called for you
    // if you configure the `handlers` module format section.
    //
    // Register an event handler in this module. The
    // given handler function will be invoked when the given event
    // name is emitted (see `emit`).
    //
    // Your handler may be async. If it is the next
    // event handler method will not begin running until your
    // handler resolves. If your handler rejects, the chain
    // stops and the `emit` method also rejects.
    //
    // "What about events of other modules?" Register them
    // with this `name` syntax: `module-name:methodName`. This is
    // similar to the "cross-module includes" syntax used
    // elsewhere in Apostrophe.
    //
    // Inheritance trees are followed. If you listen for
    // on `@apostrophecms/doc-type:beforeInsert`, your handler
    // will be invoked when that event is emitted by any module
    // that inherits from that module.

    on(name, handlerName, fn) {
      let moduleName;
      let eventName;
      const index = name.indexOf(':');
      if ((typeof handlerName) !== 'string') {
        throw new Error('When registering an Apostrophe module event handler, the second argument must be a handler name, not a function. This ensures that event handlers can be overwritten and/or extended with the "super" pattern.');
      }
      if (index === -1) {
        moduleName = self.__meta.name;
        eventName = name;
      } else {
        moduleName = name.substr(0, index);
        eventName = name.substr(index + 1);
      }
      if (_.camelCase(eventName) === _.camelCase(handlerName)) {
        throw new Error('The handler name ' + handlerName + ' is essentially identical to the event name, ' + eventName + '. To prevent conflicts with other handlers, you must give it a distinct name expressing what it actually does with the event.');
      }
      eventName = self.apos.eventAliases[`${moduleName}:${eventName}`] || eventName;
      self.apos.eventHandlers[moduleName] = self.apos.eventHandlers[moduleName] || {};
      const eh = self.apos.eventHandlers[moduleName];
      eh[eventName] = eh[eventName] || [];
      if (_.find(eh[eventName], function (item) {
        return (item.moduleName === self.__meta.name) && (item.handlerName === handlerName);
      })) {
        // The "event name and method name must differ" rule helps
        // prevent this situation, but it is still possible if this
        // method is called directly and a warning is in order
        self.apos.util.warn('The handler name ' + handlerName + ' has been registered twice for the event\n' + eventName + ' in the module ' + self.__meta.name + '. It will only be called once.\n\nYou should rename the method in your code to differ from that in the module\nit extends so they both run.\n\nIf you are intentionally overriding it, use the extendHandlers section.');
        return;
      }
      eh[eventName].push({
        moduleName: self.__meta.name,
        handlerName
      });
      self.compiledHandlers = self.compiledHandlers || {};
      self.compiledHandlers[moduleName] = self.compiledHandlers[moduleName] || {};
      self.compiledHandlers[moduleName][eventName] = self.compiledHandlers[moduleName][eventName] || {};
      self.compiledHandlers[moduleName][eventName][handlerName] = fn;
    }

  };

};
