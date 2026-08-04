// Running a model-requested tool call at runtime: argument validation,
// the handler run, result conversion, and the scheduler for one batch of
// calls. Registry validation is boot-time and lives in startup.js.

const { isObject } = require('./util');

module.exports = (self) => {
  return {
    // Execute one model-requested tool call — a toolCall content part —
    // against `tool`, its activated registry definition (getTool),
    // returning the handler's result ready to be serialized for the
    // model.
    //
    // Invalid arguments never reach the handler: they throw
    // 'aiToolError', the recoverable code, so the loop can feed the
    // validation message back to the model. Validation runs on a deep
    // clone of the requested arguments — the input schema's declared
    // "default" values are written into what the handler receives,
    // while the transcript's own toolCall part is never mutated.
    // `context` is written to `args._context` after validation, so a
    // model-provided property can never pose as core injection, and it
    // carries the executing call's own `id` and `name` — a handler that
    // records what it did can say which request it was answering. A
    // handler throw passes through untouched — recovery is decided
    // elsewhere, by the error code alone. The result must be an
    // object; a tool that declares a result schema gets it validated,
    // never mutated — the handler's object is what the model reads
    // either way. A result the schema rejects is a handler bug, not
    // model misbehaviour: it throws 'invalid', a standard code that
    // breaks the AI chain with no retries, and no detail of it is
    // ever fed back to the model. A result over the tool's declared
    // maxResultChars budget is the opposite — data-dependent, so the
    // model can correct it: the oversized result is withheld and an
    // 'aiToolError' report (actual size, budget, largest properties)
    // is fed back instead.
    async executeToolCall(req, tool, call, context = {}) {
      const args = structuredClone(call.input);
      if (!tool.validateArgs(args)) {
        throw self.apos.error('aiToolError', `invalid arguments for tool "${tool.name}": ${self.ajv.errorsText(tool.validateArgs.errors, { dataVar: 'arguments' })}`);
      }
      args._context = {
        ...context,
        call: {
          id: call.id,
          name: call.name
        }
      };
      const result = await tool.handler(req, args);
      if (!isObject(result)) {
        throw self.apos.error('invalid', `tool "${tool.name}" must return an object`);
      }
      if (tool.validateResult && !tool.validateResult(result)) {
        const errors = self.ajv.errorsText(tool.validateResult.errors, { dataVar: 'result' });
        throw self.apos.error('invalid', `tool "${tool.name}" returned a result that does not match its schema: ${errors}`);
      }
      if (tool.maxResultChars) {
        const size = JSON.stringify(result).length;
        if (size > tool.maxResultChars) {
          throw self.apos.error('aiToolError', `the result is too large: ${size} characters ` +
            `against the tool's budget of ${tool.maxResultChars}; ` +
            `largest properties: ${largestProperties(result)}; ` +
            'request less data, like fewer items or specific properties');
        }
      }
      return result;

      // The size report: top-level properties by serialized size,
      // largest first, so the model sees what to narrow
      function largestProperties(result) {
        return Object.entries(result)
          .map(([ key, value ]) => [ key, JSON.stringify(value)?.length || 0 ])
          .sort(([ , a ], [ , b ]) => b - a)
          .slice(0, 5)
          .map(([ key, length ]) => `${key} (${length})`)
          .join(', ');
      }
    },
    // Execute one batch of model-requested tool calls — the toolCall
    // parts of a single assistant turn — against `tools`, the call's
    // selected definitions as a Map by name. Reads run first, in
    // parallel; writes follow serially, in the order the model
    // requested them. Returns outcomes in model order regardless of
    // scheduling: { toolCall, result } per success, { toolCall, error }
    // per recoverable failure — a call naming a tool outside the
    // selected set, invalid arguments, or a handler's aiToolError. The
    // error message is what the model reads back, and siblings are
    // unaffected. Any other throw is a hard stop: it propagates
    // immediately, before any write runs when thrown by a read,
    // aborting the remaining writes when thrown by one — and no trace
    // of it is ever model-bound.
    //
    // Handlers run on a clone of the caller's req stamped with the
    // batch's depth (`aposAiDepth`) — an immutable property of the
    // request each handler received, never shared mutable state — so a
    // generate call a handler makes with its own req knows it is
    // nested, even delayed or from a stashed reference, while the
    // caller's original req is untouched and concurrent calls sharing
    // it are unaffected. Every batch is stamped, not only agent tools,
    // so a handler that spawns without declaring `access: 'agent'` is
    // contained all the same; `_context.depth` is the informational
    // copy a handler may act on.
    //
    // `onToolCall`, the caller's per-call progress hook, is awaited
    // around each handler that runs — a call naming no registered tool
    // never starts, so it is not reported. Its throw stops the call,
    // like every other hook; the one exception is the end report of a
    // handler that is already ending the call, where a failing hook
    // must not replace the failure on its way out.
    async executeToolCalls(req, tools, calls, context = {}, onToolCall = null) {
      const outcomes = new Array(calls.length);
      const depth = (req.aposAiDepth || 0) + 1;
      const handlerReq = req.clone({ aposAiDepth: depth });
      const handlerContext = {
        ...context,
        depth
      };
      const reads = [];
      const writes = [];
      calls.forEach((call, index) => {
        if (tools.get(call.name)?.access === 'read') {
          reads.push([ call, index ]);
        } else {
          writes.push([ call, index ]);
        }
      });
      const settled = await Promise.allSettled(
        reads.map(([ call, index ]) => run(call, index))
      );
      for (const read of settled) {
        if (read.status === 'rejected') {
          throw read.reason;
        }
      }
      for (const [ call, index ] of writes) {
        await run(call, index);
      }
      return outcomes;

      // One requested call: hand it to its tool and record the outcome
      // at its model-order index, whichever schedule ran it
      async function run(call, index) {
        const tool = tools.get(call.name);
        if (!tool) {
          outcomes[index] = {
            toolCall: call,
            error: `unknown tool "${call.name}"`
          };
          return;
        }
        const payload = {
          call,
          tool
        };
        await self.emit('beforeToolCall', req, payload);
        await report({ phase: 'start' });
        try {
          payload.result = await self.executeToolCall(
            handlerReq, tool, call, handlerContext
          );
          outcomes[index] = {
            toolCall: call,
            result: payload.result
          };
        } catch (e) {
          if (e?.name !== 'aiToolError') {
            // A call that started is always reported finished, so a
            // consumer never waits on a step that ended the run
            try {
              await report({
                phase: 'end',
                error: e.message
              });
            } catch (hookError) {
              self.logError(req, 'hook', hookError.message, {
                tool: call.name,
                stack: hookError.stack
              });
            }
            throw e;
          }
          payload.error = e.message;
          outcomes[index] = {
            toolCall: call,
            error: e.message
          };
        }
        await self.emit('afterToolCall', req, payload);
        await report({
          phase: 'end',
          ...(payload.error !== undefined
            ? { error: payload.error }
            : { result: payload.result })
        });

        // The call is what the model asked for, verbatim; the step the
        // hook also carries is the loop's, bound before it got here
        async function report(event) {
          if (!onToolCall) {
            return;
          }
          await onToolCall({
            ...event,
            call
          });
        }
      }
    }
  };
};
