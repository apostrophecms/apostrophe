// Working in an open editor. `edit_open_document` reads and changes what the
// editor on top of the screen holds, unsaved: its document, or only its
// widget or array. Each call names a document tool and does the same
// with that tool's arguments and no `_id`. The browser tab that owns the
// request posts what the editor holds to the `open-editor` route, which
// reads it or builds the change on it with the harness's own code; the
// browser applies the change through the editor's `outside` handle, and the
// result the model reads is the one the route kept on the ask.
//
// The modal rule: any editor in the stack of the request's browser tab holds
// its document, and the document tools don't write a held document. The
// harness is untouched: the MCP door has no screen.

const getCallDocumentIds = require('./call-documents');

const { getDocumentKey } = getCallDocumentIds;
const DOOR = 'assistant';
const TOOL = 'edit_open_document';
const ACTIONS = [ 'get_document', 'update_document', 'add_widgets', 'move_widgets',
  'remove_widgets' ];
// The modal kinds that edit a document, and the root each one holds
const ROOTS = {
  editor: 'document',
  widgetEditor: 'widget',
  arrayEditor: 'array'
};
// The media manager lists images and edits the one open beside the list
const SIDE_EDITORS = new Set([ 'mediaManager' ]);
// What an editor of each kind holds, as the model reads it
const PARTS = {
  widgetEditor: 'widget',
  arrayEditor: 'array'
};
const REASON_MAX = 300;

module.exports = (self) => {
  // The validators of each action's arguments, compiled once
  const validators = new Map();

  return {
    // The browser tool's definition (see lib/standard-browser-tools.js)
    getOpenEditorTool() {
      return {
        name: TOOL,
        label: 'apostrophe:aiToolEditOpenDocument',
        description: 'Read and change what the editor open on top of the screen holds, ' +
          'unsaved: its document, or only its widget or array. Nothing is stored ' +
          'until the user saves, and they may cancel. "action" names a document tool and ' +
          'does the same here, with that tool\'s arguments and no "_id": get_document ' +
          '("view" outline or properties, "paths"), update_document ("values"), ' +
          'add_widgets, move_widgets, remove_widgets. Ids and paths are the ones the ' +
          'document tools use.',
        screenEffect: 'keeps',
        input: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              enum: ACTIONS
            },
            view: {
              type: 'string',
              enum: [ 'outline', 'properties' ]
            },
            paths: {
              type: 'array',
              items: { type: 'string' }
            },
            values: { type: 'object' },
            area: { type: 'string' },
            widgets: {
              type: 'array',
              description: 'New widgets for add_widgets; widget ids for move_widgets and ' +
                'remove_widgets'
            },
            position: { type: 'integer' },
            before: { type: 'string' },
            after: { type: 'string' }
          },
          required: [ 'action' ],
          additionalProperties: false
        },
        // The result is the named document tool's
        schema: {
          type: 'object',
          properties: {},
          additionalProperties: true
        },
        maxResultChars: self.apos.harness.getReadBudget('document'),
        prepare: self.prepareOpenEditor,
        accept: self.acceptOpenEditorAnswer
      };
    },

    /**
     * Checks an `edit_open_document` call before it reaches the browser: its
     * arguments against the named document tool's own (without `_id`), and
     * on the request's screen that an editor is on top and that AI may work
     * with its document. Returns the arguments the executor and the route
     * read; throws `aiToolError` with what the model reads.
     *
     * @param {object} req
     * @param {object} args
     * @returns {Promise<object>}
     */
    async prepareOpenEditor(req, { action, ...args }) {
      const validated = checkArguments(action, args);
      self.findOpenEditor(req, await getScreen(req), action);
      return {
        action,
        ...validated
      };
    },

    /**
     * The editor on top of a verified screen, and the modal that names the
     * document it holds (the editor itself, or the one below it for a
     * nested editor that names none). Throws `aiToolError` when no editor
     * is on top, when something is open over it, or when AI may not read
     * (an action whose document tool is a query) or change the document.
     *
     * @param {object} req
     * @param {object} screen
     * @param {string} action
     * @returns {{ editor: object, held: object|null }}
     */
    findOpenEditor(req, screen, action) {
      const modals = screen?.modals || [];
      const index = modals.findLastIndex(modal => getRoot(modal));
      if (index === -1) {
        throw self.apos.error('aiToolError', 'No editor is open on the user\'s screen; ' +
          'change documents with the document tools.');
      }
      if (index < modals.length - 1) {
        throw self.apos.error('aiToolError', `${describeModal(modals.at(-1))} is open over ` +
          'the editor; ask the user to close it first.');
      }
      const editor = modals[index];
      const held = modals
        .slice(0, index + 1)
        .findLast(modal => modal.docId || modal.docType) || null;
      const verb = isRead(action) ? 'view' : 'edit';
      if (!held?.docType || !self.apos.ai.can(req, verb, held.docType)) {
        throw self.apos.error('aiToolError', (verb === 'view')
          ? 'The assistant may not read the document in this editor.'
          : 'The assistant may not change the document in this editor.');
      }
      return {
        editor,
        held
      };
    },

    /**
     * Serves the `edit_open_document` call a waiting request asked the
     * browser tab for: reads what the editor holds, or builds the change on
     * it, with the call's arguments as stored on the ask. The result the
     * model reads is kept on the ask; the browser gets what to apply.
     *
     * @param {object} req
     * @param {string} chatId
     * @param {object} input
     * @param {string} input.tabId The browser tab that owns the request.
     * @param {string} input.callId The call asked.
     * @param {object} input.root What the editor holds (see the harness's
     *   `getContentRoot`).
     * @returns {Promise<object>} `{ executed: true, values, touched,
     *   removed }`, nothing to apply for a read or a refused change, or
     *   `{ executed: false, reason }`.
     */
    async serveOpenEditor(req, chatId, {
      tabId, callId, root
    } = {}) {
      const { request } = await self.getWaiting(req, chatId, tabId);
      const ask = request.asks
        .find(ask => (ask.callId === callId) && (ask.name === TOOL));
      if (!ask) {
        throw self.apos.error('notfound', 'no such question');
      }
      const { action, ...args } = ask.payload.args;
      let result;
      let change = null;
      try {
        checkRoot(req, request.screen, root, action);
        if (isRead(action)) {
          result = self.apos.harness.readContent(req, root, args);
        } else {
          change = await self.apos.harness.editContent(req, root, {
            action,
            ...args
          });
          result = change.result;
        }
      } catch (e) {
        if (![ 'aiToolError', 'invalid' ].includes(e.name)) {
          throw e;
        }
        const failed = {
          executed: false,
          reason: String(e.message || 'the editor could not be read').slice(0, REASON_MAX)
        };
        await keep(failed);
        return failed;
      }
      await keep({
        executed: true,
        ...result
      });
      return {
        executed: true,
        values: change?.values || {},
        touched: change?.touched || [],
        removed: change?.removed || []
      };

      // By index, not the positional operator, which the SQL backends lack
      function keep(kept) {
        const index = request.asks.indexOf(ask);
        return self.requests.updateOne({
          _id: request._id,
          ownerId: request.ownerId,
          [`asks.${index}.callId`]: callId
        }, {
          $set: { [`asks.${index}.result`]: kept }
        });
      }
    },

    /**
     * The result of an `edit_open_document` call: the one the route kept,
     * once the browser applied it; the browser's reason when it could not.
     *
     * @param {object} req
     * @param {object} ask The stored ask.
     * @param {object} answer
     * @returns {object}
     */
    acceptOpenEditorAnswer(req, ask, answer) {
      const kept = ask.result;
      if (kept?.executed === false) {
        return kept;
      }
      if (kept && (answer.executed === true)) {
        return kept;
      }
      return {
        executed: false,
        reason: (typeof answer.reason === 'string')
          ? answer.reason.slice(0, REASON_MAX)
          : 'the editor\'s content did not reach the server'
      };
    },

    /**
     * An `edit_open_document` ask carries the keys the later calls of its
     * turn write (`ahead`), so they go busy with its own: the turn runs
     * them in order with no model call between.
     *
     * @param {string} name The suspended call's tool.
     * @param {string} callId
     * @param {object} payload The ask's payload.
     * @param {object[]} [calls] The turn's calls not run yet, in order.
     * @returns {object} The payload.
     */
    addOpenEditorAhead(name, callId, payload, calls = []) {
      if (name !== TOOL) {
        return payload;
      }
      const index = calls.findIndex(call => call.id === callId);
      const ahead = calls
        .slice(index + 1)
        .filter(call => (call.name === TOOL) && !isRead(call.input?.action))
        .flatMap(call => getWriteKeys(call.input || {}));
      return ahead.length
        ? {
          ...payload,
          ahead: [ ...new Set(ahead) ]
        }
        : payload;
    },

    /**
     * After `get_document` (`afterToolCall`): a document an editor in the
     * stack of the request's browser tab holds is read as saved, so the
     * result notes that the editor may hold unsaved changes and
     * `edit_open_document` reads those.
     *
     * @param {object} req
     * @param {object} payload The engine's `{ tool, args, result }`.
     */
    async noteHeldDocument(req, payload) {
      const {
        tool, args, result
      } = payload;
      const door = self.apos.harness.getDoor(req);
      // A call refused before it ran has no result and no `args`
      if (!self.active || (door?.door !== DOOR) || (tool.name !== 'get_document') ||
        !result || (typeof result !== 'object') || (args.view === 'versions')) {
        return;
      }
      const key = getDocumentKey(req, args._id);
      const holder = ((await getScreen(req))?.modals || [])
        .findLast(modal => getRoot(modal) && modal.docId &&
          (getDocumentKey(req, modal.docId) === key));
      if (!holder) {
        return;
      }
      const title = holder.title ? `"${holder.title}"` : 'This document';
      payload.result = {
        ...result,
        openEditor: `${title} is open in an editor on the user's screen, which may hold ` +
          'changes not saved yet: this read is what is saved. While it is on top, read and ' +
          `change it with ${TOOL}.`
      };
    },

    /**
     * The documents the editors of a verified screen hold, as
     * `<aposDocId>:<locale>`.
     *
     * @param {object} req
     * @param {object|null} screen
     * @returns {string[]}
     */
    getHeldDocumentKeys(req, screen) {
      return [ ...new Set((screen?.modals || [])
        .filter(modal => getRoot(modal) && modal.docId)
        .map(modal => getDocumentKey(req, modal.docId))) ];
    },

    /**
     * Before a write tool of the assistant runs (`beforeToolCall`): a
     * document held by an editor in the stack of the request's browser tab
     * is refused, with the pointer to `edit_open_document` when its editor
     * is on top, else with what to close first.
     *
     * @param {object} req
     * @param {object} payload The engine's `{ tool, args }`.
     */
    async checkHeldDocuments(req, { tool, args }) {
      const door = self.apos.harness.getDoor(req);
      if (!self.active || (door?.door !== DOOR) || (tool.kind !== 'action') ||
        !tool.tags?.includes('content')) {
        return;
      }
      const { _context, ...validated } = args;
      const modals = (await getScreen(req))?.modals || [];
      const holders = modals
        .map((modal, index) => ({
          modal,
          index
        }))
        .filter(({ modal }) => getRoot(modal) && modal.docId);
      if (!holders.length) {
        return;
      }
      for (const id of getCallDocumentIds(req, validated)) {
        const key = getDocumentKey(req, id);
        const holder = holders
          .findLast(({ modal }) => getDocumentKey(req, modal.docId) === key);
        if (!holder) {
          continue;
        }
        const { modal, index } = holder;
        const title = modal.title ? `"${modal.title}"` : 'The document';
        const part = PARTS[modal.kind];
        if (index === modals.length - 1) {
          throw self.apos.error('aiToolError', part
            ? `${title} has its ${part} editor open on the user's screen: change that ${part} ` +
              `with ${TOOL}, unsaved; the rest of the document waits until the user closes ` +
              'the editor.'
            : `${title} is open in an editor on the user's screen: change it with ${TOOL}, ` +
              'unsaved, and the user saves or cancels.');
        }
        const over = modals.slice(index + 1).map(describeModal).join(', ');
        throw self.apos.error('aiToolError', `${title} is open in an editor on the user's ` +
          `screen, under ${over}; ask the user to close what is over the editor first, ` +
          `then change it with ${TOOL}.`);
      }
    }
  };

  // The request's verified screen
  async function getScreen(req) {
    const request = await self.requests.findOne({
      _id: self.apos.harness.getDoor(req).requestId,
      ownerId: self.getOwnerId(req)
    }, { projection: { screen: 1 } });
    return request?.screen || null;
  }

  // The arguments of `action` as its document tool takes them, without
  // `_id`, defaults filled in
  function checkArguments(action, args) {
    if (!validators.has(action)) {
      validators.set(action, self.apos.ai.ajvArgs.compile(getActionSchema(action)));
    }
    const validate = validators.get(action);
    const validated = structuredClone(args);
    if (!validate(validated)) {
      throw self.apos.error('aiToolError', `invalid arguments for "${action}": ${
        self.apos.ai.ajv.errorsText(validate.errors, { dataVar: 'arguments' })
      }`);
    }
    return validated;
  }

  // Whether an action's document tool reads
  function isRead(action) {
    return self.apos.ai.getTool(action)?.kind === 'query';
  }

  // The keys a call's arguments write, as the model sent them: the keys of
  // its values, its area, the widgets it names by id
  function getWriteKeys({
    values, area, widgets
  }) {
    return [
      ...((values && (typeof values === 'object')) ? Object.keys(values) : []),
      ...((typeof area === 'string') ? [ area ] : []),
      ...(Array.isArray(widgets) ? widgets : [])
        .filter(widget => typeof widget === 'string')
        .map(_id => `@${_id}`)
    ];
  }

  // The input schema of a document tool without `_id`; for a tool that
  // writes `targets`, that of one target
  function getActionSchema(action) {
    const { input } = self.apos.ai.getTool(action);
    const schema = input.properties.targets?.items?.properties?._id
      ? input.properties.targets.items
      : input;
    const { _id, ...properties } = schema.properties;
    return {
      ...schema,
      properties,
      required: (schema.required || []).filter(name => name !== '_id')
    };
  }

  // The root the browser posts is the one the call was made for: of the
  // editor on top, a document of the type the screen names
  function checkRoot(req, screen, root, action) {
    const { editor, held } = self.findOpenEditor(req, screen, action);
    if (!root || (typeof root !== 'object') || (root.kind !== getRoot(editor))) {
      throw self.apos.error('invalid', 'the editor on top is no longer the one the call ' +
        'was made for');
    }
    if ((root.kind === 'document') && (root.data?.type !== held.docType)) {
      throw self.apos.error('invalid', 'the document in the editor is not the one the ' +
        'screen names');
    }
  }

  // The root an editor modal holds: of its kind, or the document open
  // beside a manager's list
  function getRoot(modal) {
    return ROOTS[modal.kind] ||
      ((SIDE_EDITORS.has(modal.kind) && modal.docId) ? 'document' : null);
  }

  // A modal as the model reads it in a refusal
  function describeModal(modal) {
    const title = modal.title ? ` of "${modal.title}"` : '';
    switch (modal.kind) {
      case 'chooser':
        return `a chooser${modal.field ? ` for "${modal.field}"` : ''}`;
      case 'editor':
        return `the editor${title}`;
      case 'widgetEditor':
        return 'a widget editor';
      case 'arrayEditor':
        return 'an array editor';
      case 'mediaManager':
        return `the media manager${title}`;
      case 'other':
        return 'a dialog';
      default:
        return `the ${modal.kind}${title}`;
    }
  }
};
