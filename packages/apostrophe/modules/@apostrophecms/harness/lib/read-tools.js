// The read tools' definitions. Values an argument can only take (types,
// locales) are listed when the engine activates its tools, once every module
// has registered its types.

// Read budgets, in characters of the serialized result. A read bounded by
// content can be read in parts (paths, offsets, a deeper root), and its
// budget is measured on real content. A read bounded by configuration
// (types, schemas, guidance) only has a guard against a bug or a hostile
// configuration
const BUDGETS = {
  search: 8000,
  document: 40000,
  tree: 16000,
  references: 12000,
  configuration: 100000
};

module.exports = (self) => {
  const {
    handler, id, locale
  } = require('./tool-args')(self);

  return [
    {
      name: 'search_content',
      label: 'apostrophe:aiToolSearchContent',
      description: 'Find documents by text, by type, or both, in one locale. The source of ' +
        'every document id. Returns "total", the count of every match, and each ' +
        'result\'s "updatedAt", "lastPublishedAt" (null: never published) and "modified" ' +
        '(its draft has changes not yet published). A type that publishes on save or has ' +
        'no drafts is always live and carries neither "modified" nor, without drafts, ' +
        '"lastPublishedAt". Ordered by "sort", else a "query" by relevance and a type ' +
        'listing by "updatedAt".',
      input: () => ({
        type: 'object',
        properties: {
          query: {
            type: 'string',
            minLength: 1,
            description: 'Words to search for'
          },
          type: {
            type: 'string',
            enum: self.getDocTypeNames()
          },
          ...locale('The locale to search; the current one when omitted'),
          state: {
            type: 'string',
            enum: [ 'live', 'modified', 'neverPublished' ],
            description: '"live": has a live version, changes waiting or not; "modified": ' +
              'live, with changes not yet published; "neverPublished": no live version. ' +
              'Documents of a type that is always live count as live'
          },
          sort: {
            type: 'string',
            enum: [ 'updatedAt', 'lastPublishedAt' ],
            description: 'Newest first; never published documents last'
          },
          limit: {
            type: 'integer',
            minimum: 1,
            maximum: 25,
            default: 10
          },
          offset: {
            type: 'integer',
            minimum: 0,
            default: 0,
            description: 'Results to skip: the "next" of the previous search'
          }
        },
        additionalProperties: false
      }),
      maxResultChars: BUDGETS.search,
      kind: 'query',
      handler: handler('searchContent')
    },
    {
      name: 'get_document',
      label: 'apostrophe:aiToolGetDocument',
      description: 'Read one document, in its locale, with its "lastPublishedAt" and ' +
        '"modified" as search_content gives them. "outline": every area with its ' +
        'widgets (id, type, text preview, size) and every other field with its size, ' +
        'and its value when short; a widget named in "paths" lists its own fields the ' +
        'same way. "properties": the values at "paths"; a path not found names the ' +
        'fields where it was looked for. "versions": its version history, newest first.',
      input: {
        type: 'object',
        properties: {
          _id: id('A document id'),
          view: {
            type: 'string',
            enum: [ 'outline', 'properties', 'versions' ],
            default: 'outline'
          },
          paths: {
            type: 'array',
            items: {
              type: 'string',
              minLength: 1
            },
            minItems: 1,
            maxItems: 20,
            description: '"properties": the values to read, by field name, dot path or ' +
              '"@<id>" path ("@<widget id>.title"); required. "outline": only these ' +
              'areas or widgets ("main", "@<widget id>")'
          },
          before: {
            type: 'string',
            description: 'For "versions": the "next" of the previous versions read'
          }
        },
        required: [ '_id' ],
        additionalProperties: false
      },
      maxResultChars: BUDGETS.document,
      kind: 'query',
      handler: handler('getDocument')
    },
    {
      name: 'list_types',
      label: 'apostrophe:aiToolListTypes',
      description: 'The page, piece and widget types with their labels; for doc types, ' +
        'how they go live ("drafts": an editor publishes, "autopublish": live on save, ' +
        '"noDrafts": always live), and for piece types the slugs of the pages listing them.',
      input: {
        type: 'object',
        properties: {},
        additionalProperties: false
      },
      maxResultChars: BUDGETS.configuration,
      kind: 'query',
      handler: handler('listTypes')
    },
    {
      name: 'get_schema',
      label: 'apostrophe:aiToolGetSchema',
      description: 'The fields of doc and widget types, one line per field, with a ' +
        'legend of the format. A conditional field\'s own fields are folded; read them ' +
        'with "fields".',
      input: () => ({
        type: 'object',
        properties: {
          types: {
            type: 'array',
            items: {
              type: 'string',
              enum: self.getTypeNames()
            },
            minItems: 1,
            maxItems: 10
          },
          fields: {
            type: 'array',
            items: {
              type: 'string',
              minLength: 1
            },
            minItems: 1,
            maxItems: 10,
            description: 'Folded fields to read in full, by dot path of field names ' +
              '("details", "items.details"); one type only'
          }
        },
        required: [ 'types' ],
        additionalProperties: false
      }),
      maxResultChars: BUDGETS.configuration,
      kind: 'query',
      handler: handler('getSchema')
    },
    {
      name: 'get_guidance',
      label: 'apostrophe:aiToolGetGuidance',
      description: 'How to use types the instructions mark "(aiHow)": their guidance, ' +
        'to read before working with them.',
      input: () => {
        const types = self.getTypeNames()
          .filter(type => self.getTypeOptions(type).aiHow?.trim());
        return {
          type: 'object',
          properties: {
            types: {
              type: 'array',
              items: {
                type: 'string',
                ...(types.length && { enum: types })
              },
              minItems: 1,
              maxItems: 10
            }
          },
          required: [ 'types' ],
          additionalProperties: false
        };
      },
      maxResultChars: BUDGETS.configuration,
      kind: 'query',
      handler: handler('getGuidance')
    },
    {
      name: 'get_page_tree',
      label: 'apostrophe:aiToolGetPageTree',
      description: 'The page tree in tree order: each page with its id, title, slug, type, ' +
        'level, parent and number of children. Starts at the home page or at "root"; ' +
        'when "truncated", read on from a deeper root.',
      input: () => ({
        type: 'object',
        properties: {
          root: {
            type: 'string',
            minLength: 1,
            description: 'A page id or slug ("/services") to start from'
          },
          depth: {
            type: 'integer',
            minimum: 1,
            maximum: 5,
            default: 2,
            description: 'Levels below the start'
          },
          ...locale('The locale of the tree, when "root" is not an id; the current one ' +
            'when omitted')
        },
        additionalProperties: false
      }),
      maxResultChars: BUDGETS.tree,
      kind: 'query',
      handler: handler('getPageTree')
    },
    {
      name: 'find_references',
      label: 'apostrophe:aiToolFindReferences',
      description: 'Documents that point at a document through a relationship ("where is ' +
        'this image used"), with the paths where each holds it, and their total.',
      input: {
        type: 'object',
        properties: {
          _id: id('The id of the document pointed at'),
          limit: {
            type: 'integer',
            minimum: 1,
            maximum: 50,
            default: 50
          },
          offset: {
            type: 'integer',
            minimum: 0,
            default: 0,
            description: 'Documents to skip: the "next" of the previous read'
          }
        },
        required: [ '_id' ],
        additionalProperties: false
      },
      maxResultChars: BUDGETS.references,
      kind: 'query',
      handler: handler('findReferences')
    },
    {
      name: 'get_changes',
      label: 'apostrophe:aiToolGetChanges',
      description: 'What changed in one document since its last publication, since a ' +
        'version, or in one request. Each row: "path", usable as an update_document key, ' +
        'the change, the values before and after, who, when and the AI mark. An added ' +
        'widget\'s "place" is its area and spot as add_widgets takes them.',
      input: {
        type: 'object',
        properties: {
          _id: id('A document id'),
          since: {
            type: 'string',
            minLength: 1,
            default: 'publication',
            description: '"publication", or a versionId of get_document\'s versions'
          },
          requestId: id('A request\'s id: only the changes it made, instead of "since"'),
          offset: {
            type: 'integer',
            minimum: 0,
            default: 0,
            description: 'Rows to skip: the "next" of the previous read'
          }
        },
        required: [ '_id' ],
        additionalProperties: false
      },
      maxResultChars: BUDGETS.document,
      kind: 'query',
      handler: handler('getChanges')
    }
  ];
};
