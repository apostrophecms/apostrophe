// The tools the server lists and runs: the harness's selection for the `mcp`
// door, run as the connected user through the assistant's own path,
// `apos.ai.executeToolCalls`, which validates the arguments, checks the
// result budget and stamps each save with its tool call for the change log.

const { fromJsonSchema } = require('@modelcontextprotocol/server');

// Tools whose writes remove content. Every other action only adds or
// changes, as a draft (MCP assumes destructive unless told otherwise)
const DESTRUCTIVE = new Set([ 'remove_widgets' ]);

// The result of a call that stopped to ask the user something
const SUSPENDED = 'This tool needs an answer from the user before it can go on, ' +
  'and this connection can\'t ask for one. The call did not run, so nothing ' +
  'was changed. Don\'t call it again with the same arguments; tell the user ' +
  'what you were trying to do.';

// The SDK would validate arguments before the tool runs, with its own
// messages. The engine validates them as it does for the assistant, so
// the SDK only lists the schema
const PASS_THROUGH = {
  getValidator() {
    return (data) => ({
      valid: true,
      data,
      errorMessage: undefined
    });
  }
};

module.exports = (self) => {
  return {
    // The definitions the door selects, as a Map by name, as the engine
    // takes them
    getTools() {
      return new Map(
        self.apos.harness.getDoorTools('mcp').map(tool => [ tool.name, tool ])
      );
    },

    // Registers every tool on one request's server
    registerTools(server, req) {
      for (const tool of self.getTools().values()) {
        server.registerTool(tool.name, {
          title: tool.label ? req.t(tool.label) : undefined,
          description: tool.description,
          inputSchema: fromJsonSchema(tool.input, PASS_THROUGH),
          annotations: getAnnotations(tool)
        }, (input) => self.callTool(req, tool.name, input));
      }
    },

    // One `tools/call`, as an MCP tool result. A failure the model can act
    // on (invalid arguments, a result over budget, a refusal the tool
    // reports) is a result with `isError` and the engine's message. Anything
    // else is logged; the SDK turns the throw into an `isError` result with
    // its message, so it carries no detail. A name the SDK has not
    // registered never gets here: it answers a protocol error itself
    async callTool(req, name, input) {
      let outcome;
      try {
        outcome = await self.runTool(req, name, input);
      } catch (e) {
        self.logError(req, 'mcp-tool-error', e.message, {
          tool: name,
          stack: e.stack
        });
        throw new Error('Internal error');
      }
      if (outcome.error !== undefined) {
        return errorResult(outcome.error);
      }
      if (outcome.suspended !== undefined) {
        // No tool the door selects asks today: the asking tools and the
        // approval gates are the assistant's. The engine leaves a suspended
        // call unexecuted. Worded as final, so the model tells the user
        // instead of calling again, which would only ask again. Asking
        // through the protocol (elicitation, input required) is later work
        return errorResult(SUSPENDED);
      }
      // An action's result names its request, the key get_changes takes for
      // what it changed: each call over MCP is a request of its own
      const isAction = self.getTools().get(name)?.kind !== 'query';
      const result = (isAction && isPlainObject(outcome.result))
        ? {
          ...outcome.result,
          requestId: outcome.requestId
        }
        : outcome.result;
      return {
        content: [ {
          type: 'text',
          text: JSON.stringify(result)
        } ],
        ...(isPlainObject(result) && { structuredContent: result })
      };
    },

    /**
     * Runs one tool call as `req`'s user, through the `mcp` door: the one
     * call to `apos.ai.executeToolCalls` in this module. Each call is its own
     * door request, whose id is also its lock id, so two overlapping calls
     * never share a lock.
     *
     * @param {object} req
     * @param {string} name
     * @param {object} [input]
     * @returns {Promise<{ requestId: string, result?: object, error?: string,
     *   suspended?: any }>} The engine's outcome with the call's request id;
     *   a tool outside the selection is an `error`.
     */
    async runTool(req, name, input) {
      const requestId = self.apos.util.generateId();
      const doorReq = self.apos.harness.withDoor(req, {
        door: 'mcp',
        lockId: requestId,
        requestId,
        // No confirmation step over MCP: a refused write after another
        // user's save tells the model to ask before replacing their work
        askBeforeOverwrite: true,
        ...(req.aposMcpClient && { client: req.aposMcpClient }),
        ...(req.aposMcpConnection && {
          seen: await self.getSeen(req.aposMcpConnection)
        })
      });
      try {
        const call = {
          id: requestId,
          name,
          input: input ?? {}
        };
        const [ outcome ] = await self.apos.ai.executeToolCalls(
          doorReq, self.getTools(), [ call ]
        );
        return {
          ...outcome,
          requestId
        };
      } finally {
        await self.apos.harness.endRequest(doorReq);
      }
    }
  };
};

function getAnnotations(tool) {
  if (tool.kind === 'query') {
    return {
      readOnlyHint: true,
      openWorldHint: false
    };
  }
  return {
    readOnlyHint: false,
    destructiveHint: DESTRUCTIVE.has(tool.name),
    openWorldHint: false
  };
}

function errorResult(message) {
  return {
    isError: true,
    content: [ {
      type: 'text',
      text: message
    } ]
  };
}

function isPlainObject(value) {
  return Boolean(value) && (typeof value === 'object') && !Array.isArray(value);
}
