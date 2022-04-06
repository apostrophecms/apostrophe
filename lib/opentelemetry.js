// Initialize OpenTelemetry tracer singleton and export
// the most useful API members, the tracer and some helper functions.
//
// The library shouldn't be used directly (although it's not fatal),
// it is registered as self.apos.telemetry pseudo module (see index.js).
const api = require('@opentelemetry/api');
const version = require('../package.json').version;

/** @type {api.Tracer} */
let tracer;

const AposAttributes = {
  SCENE: 'apos.scene',
  TEMPLATE: 'apos.template',
  EVENT_MODULE: 'apos.event.module',
  EVENT_NAME: 'apos.event.name',
  // The module and method targeted by the current operation (see doc module)
  TARGET_NAMESPACE: 'apos.target.namespace',
  TARGET_FUNCTION: 'apos.target.function'
};

module.exports = function (options = {}) {
  if (!tracer) {
    tracer = api.trace.getTracer('apostrophe', version);

    // This shouldn't be needed, but having it doesn't hurt
    if (options.openTelemetryProvider) {
      api.trace.setGlobalTracerProvider(options.openTelemetryProvider);
    }
  }

  /**
   * Start and return a new span. Optionally provide a parent span or allow the parent
   * span to be auto-detected.
   * Use this when the current code block does the tracing and it doesn't expect
   * more tracing to happen down the line.
   *
   * @param {String} name span name
   * @param {api.Span|Boolean} [parentSpan] optional parent span
   * @param {api.SpanOptions} [options] span options
   * @returns {api.Span}
   * @example
   * // Auto-merge with the currently active span context
   * const span = self.apos.telemetry.aposStartSpan('event:someEvent');
   * // Provide a parent span
   * const span = self.apos.telemetry.aposStartSpan('event:someEvent', parent);
   * // Do not merge with any parent, start as a root
   * const span = self.apos.telemetry.aposStartSpan('event:someEvent', false);
   * // Provide options for the newly created span
   * const span = self.apos.telemetry.aposStartSpan('event:someEvent', true, {
   *   attributes: [
   *     [SemanticAttributes.HTTP_METHOD]: "GET",
   *     [SemanticAttributes.HTTP_FLAVOR]: "1.1",
   *     [SemanticAttributes.HTTP_URL]: req.url
   *   ]
   * });
   */
  function aposStartSpan(name, parentSpan, options) {
    if ((!parentSpan || parentSpan === true) && parentSpan !== false) {
      parentSpan = api.trace.getSpan(api.context.active());
    }

    if (parentSpan) {
      const ctx = api.trace.setSpan(api.context.active(), parentSpan);
      return tracer.startSpan(name, options || undefined, ctx);
    }

    return tracer.startSpan(name, options || undefined);
  }

  /**
   * Start span and make it active for all the nested spans.
   * Use this when the current code block does the tracing, but it also expects
   * more tracing to happen down the line (async calls).
   *
   * @param {String} name span name
   * @param {Function} fn callback function
   * @param {api.Span|Boolean} [parentSpan] optional parent span
   * @param {api.SpanOptions} [options] span options
   * @returns {api.Span|any} the return value of the callback or the newly created span
   * @example
   * // Activate span, return some value
   * const value = await self.apos.telemetry.aposStartActiveSpan(spanName, async (span) => {
   *   // Use the span, do work, end span, return any value
   *   span.end();
   *   return value;
   * });
   * // Activate span, using the context of parent span, return the active span
   * const span = self.apos.telemetry.aposStartActiveSpan(spanName, async (span) => {
   *   // Use the span, do work, return the span
   *   return span;
   * });
   */
  function aposStartActiveSpan(name, fn, parentSpan, options) {
    if (parentSpan) {
      const ctx = api.trace.setSpan(api.context.active(), parentSpan);
      return tracer.startActiveSpan(name, options || undefined, ctx, fn);
    }

    return tracer.startActiveSpan(name, options || undefined, fn);
  }

  /**
   * Invoke a callback within a new context (merged with a parent span).
   * Use this when the current code block doesn't need to do the tracing, but it has
   * to set the context for the eventual tracing down the line.
   *
   * @param {String} name span name
   * @param {api.Span} parentSpan optional parent span
   * @param {api.SpanOptions} [options] span options
   * @param {Function} fn callback function
   * @param {any} fnArgs callback function arguments
   * @returns {any} the return value of the callback
   * @example
   * const value = await self.apos.telemetry.aposParentContextWith(
   *   spanName,
   *   parentSpan,
   *   { kind: 1 },
   *   self.someMethod,
   *   arg1,
   *   arg2
   * );
   */
  function aposParentContextWith(name, parentSpan, options, fn, ...fnArgs) {
    const parentCtx = parentSpan
      ? api.trace.setSpan(api.context.active(), parentSpan)
      : api.context.active();

    const span = tracer.startSpan(name, options || undefined, parentCtx);
    const ctx = api.trace.setSpan(parentCtx, span);

    return api.context.with(ctx, fn, undefined, ...fnArgs);
  }

  /**
   * Invoke a callback within a new context (merged with the currently active context).
   * Use this when the current code block doesn't need to do the tracing, but it has
   * to set the context for the eventual tracing down the line.
   *
   * @param {String} name span name
   * @param {api.SpanOptions} [options] span options
   * @param {Function} fn callback function
   * @param {any} fnArgs callback function arguments
   * @returns {any} the return value of the callback
   * @example
   * const value = await self.apos.telemetry.aposContextWith(
   *   spanName,
   *   { kind: 1 },
   *   self.someMethod,
   *   arg1,
   *   arg2
   * );
   */
  function aposContextWith(name, options, fn, ...fnArgs) {
    return aposParentContextWith(name, null, options, fn, fnArgs);
  }

  /**
   * Handle errors helper (catch block).
   *
   * @param {api.Span} span
   * @param {Error|String} err
   */
  function aposHandleError(span, err) {
    span.recordException(err);
    span.setStatus({
      code: api.SpanStatusCode.ERROR,
      message: typeof err === 'string' ? err : err.message
    });
  }

  return {
    SpanStatusCode: api.SpanStatusCode,
    SpanKind: api.SpanKind,
    context: api.context,
    ROOT_CONTEXT: api.ROOT_CONTEXT,
    trace: api.trace,
    tracer,
    AposAttributes,
    aposHandleError,
    aposStartSpan,
    aposStartActiveSpan,
    aposContextWith,
    aposParentContextWith
  };
};
