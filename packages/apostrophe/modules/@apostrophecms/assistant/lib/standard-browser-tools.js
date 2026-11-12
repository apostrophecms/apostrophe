// The assistant's own browser tools. Each call is checked on the server
// before it reaches the browser, so a call the browser could never serve is
// refused to the model at once instead of waiting on the editor's screen.

const URL_MAX = 2000;
const WIDGETS_MAX = 50;

module.exports = (self) => {
  return [
    {
      name: 'read_screen',
      label: 'apostrophe:aiToolReadScreen',
      description: 'Read the screen as it is now: the page, the modals open over it, ' +
        'the selected widgets and the field being edited. Every browser tool returns ' +
        'the screen after its action, so this is for when the user may have moved since.',
      screenEffect: 'keeps',
      input: {
        type: 'object',
        properties: {},
        additionalProperties: false
      },
      // Nobody changes the screen of a hidden browser tab: the stored one
      // is the screen as it is now
      whenHidden: { executed: true }
    },
    {
      name: 'navigate',
      label: 'apostrophe:aiToolNavigate',
      description: 'Take the user to a page: a document with a page of its own by "_id", ' +
        'or a URL of this site. The page loads anew and answers: "executed" true means ' +
        'the browser arrived, and "screen" is the new page.',
      screenEffect: 'changes',
      input: {
        type: 'object',
        properties: {
          _id: {
            type: 'string',
            description: 'The document to go to'
          },
          url: {
            type: 'string',
            maxLength: URL_MAX,
            description: 'A URL of this site, or its path starting with "/", when there ' +
              'is no document to name'
          }
        },
        additionalProperties: false
      },
      async prepare(req, { _id, url }) {
        if (Boolean(_id) === Boolean(url)) {
          throw self.apos.error('aiToolError', 'give either "_id" or "url"');
        }
        if (url) {
          if (!isSiteUrl(url)) {
            throw self.apos.error('aiToolError', '"url" is a URL of this site or a path starting with "/"');
          }
          return { url };
        }
        const { doc } = await findDoc(req, _id);
        if (!doc._url) {
          throw self.apos.error('aiToolError', `"${doc.title}" has no page of its own`);
        }
        return {
          _id: doc._id,
          url: doc._url
        };
      }
    },
    {
      name: 'open_editor',
      label: 'apostrophe:aiToolOpenEditor',
      description: 'Open the editor of a document, or of one of its widgets on the page ' +
        'the user is on. By default the answer comes once the editor is open. With ' +
        '"until": "closed" it comes when the user closes it, "saved" saying whether they ' +
        'saved; you wait for as long as they edit, so ask for it only when your next ' +
        'step depends on it.',
      screenEffect: 'changes',
      input: {
        type: 'object',
        properties: {
          _id: {
            type: 'string',
            description: 'The document'
          },
          widgetId: {
            type: 'string',
            description: 'A widget of the document to open instead'
          },
          until: {
            type: 'string',
            enum: [ 'open', 'closed' ],
            default: 'open'
          }
        },
        required: [ '_id' ],
        additionalProperties: false
      },
      schema: {
        type: 'object',
        properties: {
          saved: {
            type: 'boolean',
            description: 'With "until": "closed": the user saved'
          }
        }
      },
      async prepare(req, {
        _id, widgetId, until
      }) {
        const { doc, ids } = await findDoc(req, _id);
        if (widgetId && (ids.get(widgetId) !== 'widget')) {
          throw self.apos.error('aiToolError', `"${doc.title}" has no widget "${widgetId}"`);
        }
        return {
          _id: doc._id,
          type: doc.type,
          ...(widgetId && { widgetId }),
          until
        };
      }
    },
    {
      name: 'show_widgets',
      label: 'apostrophe:aiToolShowWidgets',
      description: 'Show the user widgets on the page they are on: edit mode, scrolled to ' +
        'and selected, siblings in one area or the area holding them all. "selected" ' +
        'lists the widgets selected; "executed" false comes with the reason.',
      screenEffect: 'changes',
      input: {
        type: 'object',
        properties: {
          _id: {
            type: 'string',
            description: 'The document the widgets are in'
          },
          widgetIds: {
            type: 'array',
            items: { type: 'string' },
            minItems: 1,
            maxItems: WIDGETS_MAX
          }
        },
        required: [ '_id', 'widgetIds' ],
        additionalProperties: false
      },
      schema: {
        type: 'object',
        properties: {
          selected: {
            type: 'array',
            items: { type: 'string' }
          }
        }
      },
      async prepare(req, { _id, widgetIds }) {
        const { doc, ids } = await findDoc(req, _id);
        const unknown = widgetIds.filter(widgetId => ids.get(widgetId) !== 'widget');
        if (unknown.length) {
          throw self.apos.error('aiToolError', `"${doc.title}" has no widget ${
            unknown.map(widgetId => `"${widgetId}"`).join(', ')
          }`);
        }
        return {
          _id: doc._id,
          widgetIds
        };
      }
    }
  ];

  async function findDoc(req, _id) {
    const found = await self.findScreenDoc(req, _id);
    if (!found) {
      throw self.apos.error('aiToolError', `no document "${_id}" to show`);
    }
    return found;
  }

  // A path of this site, or an absolute http(s) URL; the browser refuses
  // another site's
  function isSiteUrl(url) {
    if (url.startsWith('/')) {
      return !/^\/[/\\]/.test(url);
    }
    try {
      return [ 'http:', 'https:' ].includes(new URL(url).protocol);
    } catch (e) {
      return false;
    }
  }
};
