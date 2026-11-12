// Browser tools: steps of a request that happen on the editor's screen, such
// as going to a page, opening an editor or selecting widgets. Each is an
// action on the AI engine tagged `assistant` and `browser`, so only the
// assistant's door selects it. Its call suspends the run with a `browser`
// ask; the browser tab that owns the request runs the tool's executor
// (`apos.assistant.browserTools` in the admin UI) and answers with the
// outcome and the screen after it, which continues the run.
//
// Every result has a shared half: `answered` (the outcome is known; `false`
// only when the ask was set aside unanswered), `executed` (the browser
// performed the action), `reason` (why it didn't) and `screen` (the screen
// after the action, as the model reads it), the tool's own fields beside it.
//
// A hidden browser tab runs nothing. While the owning browser tab is
// hidden, the call is answered on the server with the tool's `whenHidden`
// and the stored screen, which nobody changes meanwhile; the ask carries
// the same answer for a browser tab that went hidden after it was asked.

const SCREEN_EFFECTS = [ 'keeps', 'changes' ];
const REASON_MAX = 300;
const HIDDEN = {
  executed: false,
  reason: 'the user is in another browser tab'
};

const SHARED = {
  answered: {
    type: 'boolean',
    description: 'The outcome is known; false: set aside unanswered, outcome unknown'
  },
  executed: {
    type: 'boolean',
    description: 'The browser performed the action'
  },
  reason: {
    type: 'string',
    maxLength: REASON_MAX,
    description: 'Why the browser did not perform it'
  },
  screen: {
    type: 'object',
    description: 'The screen after the action'
  }
};

module.exports = (self) => {
  return {
    /**
     * Registers a browser tool on the AI engine. Last registration wins by
     * name, and the admin UI's executor of the same name runs it. Like any
     * tool, it must be registered before "apostrophe:ready"; with the
     * assistant not enabled, nothing is registered.
     *
     * @param {object} tool
     * @param {string} tool.name
     * @param {string} tool.description What the model reads.
     * @param {string} [tool.label] What the panel shows for a step; may be
     *   an i18n key.
     * @param {'keeps'|'changes'} tool.screenEffect Whether the tool leaves
     *   what the editor is looking at as it was (it reads, or writes into
     *   an editor already open) or moves the editor somewhere else.
     * @param {object} tool.input The JSON Schema of the model's arguments.
     * @param {object} [tool.schema] The JSON Schema of the tool's own result
     *   fields, beside the shared half; an object root with `properties`.
     * @param {(req: object, args: object) => Promise<object>} [tool.prepare]
     *   Checks a call on the server before it reaches the browser, and
     *   returns the arguments the executor receives (the model's, when
     *   there is no `prepare`). Throws `aiToolError` to refuse the call
     *   with a message the model reads.
     * @param {object} [tool.whenHidden] The tool's answer while the owning
     *   browser tab is hidden, beside the stored screen: by default
     *   `executed: false` with the reason.
     */
    addBrowserTool({
      name, description, label, screenEffect, input, schema = {}, prepare,
      whenHidden = HIDDEN
    }) {
      if (!self.options.enabled) {
        return;
      }
      if (!SCREEN_EFFECTS.includes(screenEffect)) {
        throw new Error(
          `The browser tool "${name}" needs a screenEffect: ${SCREEN_EFFECTS.join(' or ')}.`
        );
      }
      if (typeof whenHidden?.executed !== 'boolean') {
        throw new Error(
          `The browser tool "${name}" answers "executed" when its browser tab is hidden.`
        );
      }
      self.apos.ai.addTool({
        name,
        description,
        ...(label && { label }),
        kind: 'action',
        tags: [ 'assistant', 'browser' ],
        input,
        schema: {
          type: 'object',
          properties: {
            ...SHARED,
            ...schema.properties
          },
          required: [ 'answered', 'executed', 'screen', ...(schema.required || []) ],
          additionalProperties: false
        },
        async handler(req, { _context, ...args }) {
          if (_context.input !== undefined) {
            return _context.input;
          }
          const prepared = prepare ? await prepare(req, args) : args;
          const { screen } = await self.requests.findOne({
            _id: self.apos.harness.getDoor(req).requestId,
            ownerId: self.getOwnerId(req)
          }, { projection: { screen: 1 } });
          if (screen.visible === false) {
            return {
              ...whenHidden,
              answered: true,
              screen: self.renderScreen(screen)
            };
          }
          throw self.apos.error('aiInput', `waiting for the browser to run ${name}`, {
            kind: 'browser',
            screenEffect,
            args: prepared,
            whenHidden
          });
        }
      });
    },

    /**
     * Turns a browser's answer to a `browser` ask into the tool's result:
     * the shared half, the tool's own fields and the screen posted with
     * it. An answer the tool's result schema refuses is `invalid`, and
     * the ask keeps waiting.
     *
     * @param {object} req
     * @param {object} ask The stored ask.
     * @param {object} answer What the executor returned.
     * @param {object} context
     * @param {object|null} context.screen The verified screen.
     * @returns {object}
     */
    acceptBrowserAnswer(req, ask, answer, { screen }) {
      const tool = self.apos.ai.getTool(ask.name);
      if (!tool) {
        throw self.apos.error('invalid', `there is no browser tool "${ask.name}"`);
      }
      if (!screen) {
        throw self.apos.error('invalid', 'a browser answer carries the screen');
      }
      const {
        answered, screen: ignored, ...rest
      } = (answer && (typeof answer === 'object')) ? answer : {};
      const result = {
        ...rest,
        answered: true,
        screen: self.renderScreen(screen)
      };
      if (!tool.validateResult(result)) {
        throw self.apos.error('invalid', `the answer does not match the "${ask.name}" result: ${
          self.apos.ai.ajv.errorsText(tool.validateResult.errors, { dataVar: 'answer' })
        }`);
      }
      return result;
    }
  };
};
