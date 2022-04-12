// Initialize OpenTelemetry tracer singleton and export
// the most useful API members, the tracer and some helper functions.
//
// The library shouldn't be used directly (although it's not fatal),
// it is registered as self.apos.telemetry pseudo module (see index.js).
const api = require('@opentelemetry/api');
const util = require('util');
const version = require('../package.json').version;

/** @type {api.Tracer} */
let tracer;

const Attributes = {
  SCENE: 'apos.scene',
  TEMPLATE: 'apos.template',
  EVENT_MODULE: 'apos.event.module',
  EVENT_NAME: 'apos.event.name',
  // The module and method targeted by the current operation (see doc module)
  TARGET_NAMESPACE: 'apos.target.namespace',
  TARGET_FUNCTION: 'apos.target.function',
  ARGV: 'apos.argv'
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
   * const span = self.apos.telemetry.startSpan('event:someEvent');
   * // Provide a parent span
   * const span = self.apos.telemetry.startSpan('event:someEvent', parent);
   * // Do not merge with any parent, start as a root
   * const span = self.apos.telemetry.startSpan('event:someEvent', false);
   * // Provide options for the newly created span
   * const span = self.apos.telemetry.startSpan('event:someEvent', true, {
   *   attributes: [
   *     [SemanticAttributes.HTTP_METHOD]: "GET",
   *     [SemanticAttributes.HTTP_FLAVOR]: "1.1",
   *     [SemanticAttributes.HTTP_URL]: req.url
   *   ]
   * });
   */
  function startSpan(name, parentSpan, options) {
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
   * @param {Function} fn handler function
   * @param {api.Span|Boolean} [parentSpan] optional parent span
   * @param {api.SpanOptions} [options] span options
   * @returns {api.Span|any} the return value of the handler or the newly created span
   * @example
   * // Activate span, return some value
   * const value = await self.apos.telemetry.startActiveSpan(spanName, async (span) => {
   *   // Use the span, do work, end span, return any value
   *   span.end();
   *   return value;
   * });
   * // Activate span, using the context of parent span, return the active span
   * const span = self.apos.telemetry.startActiveSpan(spanName, async (span) => {
   *   // Use the span, do work, return the span
   *   return span;
   * });
   */
  function startActiveSpan(name, fn, parentSpan, options) {
    if (parentSpan) {
      const ctx = api.trace.setSpan(api.context.active(), parentSpan);
      return tracer.startActiveSpan(name, options || undefined, ctx, fn);
    }

    return tracer.startActiveSpan(name, options || undefined, fn);
  }

  /**
   * Handle errors helper (catch block).
   *
   * @param {api.Span} span
   * @param {Error|String} err
   */
  function handleError(span, err) {
    span.recordException(err);
    span.setStatus({
      code: api.SpanStatusCode.ERROR,
      message: err
        ? typeof err === 'string' ? err : err.message
        : undefined
    });
  }

  /**
   * Stringify object - helper to properly set
   * object as a span attribute value.
   *
   * @param {Object} obj
   * @returns {String}
   */
  function stringify(obj) {
    return util.inspect(obj, {
      depth: 20,
      compact: false
    });
  }

  return {
    api,
    tracer,
    Attributes,
    stringify,
    handleError,
    startSpan,
    startActiveSpan
  };
};
