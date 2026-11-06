// The tools an AI localization pass works with. Each pass is bound to one
// pair of copies — the source document in its locale, its copy in the target
// locale — carried on the request as `req.aposAiLocalize` by the run that
// starts the pass (see lib/run.js). So no tool takes a document id: a read
// names "source" or "target", and every write lands on the target. The model
// cannot reach any other document, whatever it is asked.
//
// Every handler acts as the editor who started the localization: reads and
// writes go through the editor's own request, and `apos.ai.can` stands in
// front of every write.

const {
  splitParts, isPartAddress, parsePartAddress, spliceParts
} = require('./parts');

// Budgets for a read, in characters of the serialized result. Reads that
// could exceed them come in pages, and long fields in parts (see parts.js),
// so a long document is never too much to handle, just more calls
const TEXT_MAX_CHARS = 60000;
const DOC_MAX_CHARS = 50000;
const OUTLINE_MAX_CHARS = 20000;

// Properties a write may never set: identity, the page tree's coordinates
// and the URL, which stays the editor's call
const UNWRITABLE = [
  '_id', 'aposDocId', 'aposLocale', 'aposMode', 'type', 'archived', 'slug',
  'path', 'level', 'rank', 'parkedId', 'metaType'
];

const COPY = {
  type: 'string',
  enum: [ 'source', 'target' ],
  description: 'Which copy to read: the source, or the translation'
};

const TOOLS = [
  {
    name: 'localize_read_text',
    label: 'apostrophe:aiLocalizeToolReadText',
    description: 'Every piece of translatable text in one copy, in ' +
      'document order: plain text fields and rich text, each with the ' +
      '"address" localize_update takes and where it sits, in the ' +
      'editor\'s words. Rich text comes as HTML. Settings, links, images ' +
      'and other non-text values are left out. A long document comes in ' +
      'pages: pass "next" back as "offset". A long field comes in parts, ' +
      'each with "part" and "parts" and an address ending in "#<range>" ' +
      '(e.g. "@abc123.content#0-14"): write each part to its own address ' +
      'with localize_update, never the whole field.',
    input: {
      type: 'object',
      properties: {
        copy: COPY,
        offset: {
          type: 'integer',
          minimum: 0,
          description: 'Where to continue a paged read'
        }
      },
      required: [ 'copy' ],
      additionalProperties: false
    },
    maxResultChars: TEXT_MAX_CHARS + 2000,
    tags: [ 'ai-localize' ],
    kind: 'query',
    handler: '@apostrophecms/ai-localize:readText'
  },
  {
    name: 'localize_read_outline',
    label: 'apostrophe:aiLocalizeToolReadOutline',
    description: 'The structure of one copy: every area with its widgets — ' +
      '_id, type, position and a short text preview. Use it to see how ' +
      'the two copies line up, or where to add a widget. A long outline ' +
      'comes in pages: pass "next" back as "offset".',
    input: {
      type: 'object',
      properties: {
        copy: COPY,
        offset: {
          type: 'integer',
          minimum: 0,
          description: 'Where to continue a paged outline'
        }
      },
      required: [ 'copy' ],
      additionalProperties: false
    },
    maxResultChars: OUTLINE_MAX_CHARS + 2000,
    tags: [ 'ai-localize' ],
    kind: 'query',
    handler: '@apostrophecms/ai-localize:readOutline'
  },
  {
    name: 'localize_read',
    label: 'apostrophe:aiLocalizeToolRead',
    description: 'Values of one copy as stored, at "paths": dot notation, ' +
      'or "@<_id>" for a widget or array item wherever it sits ' +
      '("@abc123" reads it whole, "@abc123.caption" one field). For ' +
      'what localize_read_text leaves out, like a whole widget to copy ' +
      'into the target. For long text use localize_read_text, which ' +
      'splits it into parts.',
    input: {
      type: 'object',
      properties: {
        copy: COPY,
        paths: {
          type: 'array',
          items: {
            type: 'string',
            minLength: 1
          },
          minItems: 1,
          maxItems: 20
        }
      },
      required: [ 'copy', 'paths' ],
      additionalProperties: false
    },
    maxResultChars: DOC_MAX_CHARS,
    tags: [ 'ai-localize' ],
    kind: 'query',
    handler: '@apostrophecms/ai-localize:readPaths'
  },
  {
    name: 'localize_widget_schema',
    label: 'apostrophe:aiLocalizeToolWidgetSchema',
    description: 'The fields of one widget type, for localize_add_widget.',
    input: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          minLength: 1
        }
      },
      required: [ 'type' ],
      additionalProperties: false
    },
    tags: [ 'ai-localize' ],
    kind: 'query',
    handler: '@apostrophecms/ai-localize:widgetSchema'
  },
  {
    name: 'localize_update',
    label: 'apostrophe:aiLocalizeToolUpdate',
    description: 'Write values into the target copy. Keys are the ' +
      'addresses localize_read_text reports — a field name, a dot path, ' +
      'or "@<_id>.field" for a field of a widget or array item — or ' +
      '"@<_id>" alone to replace a whole widget. A part of a long field ' +
      'takes the part\'s address, "#<range>" included, and replaces just ' +
      'that part. Send many keys in one call. Rich text takes HTML: keep ' +
      'the markup, links and structure of what you translate, changing ' +
      'only the words.',
    input: {
      type: 'object',
      properties: {
        values: {
          type: 'object',
          minProperties: 1,
          description: 'The values to write, by address'
        }
      },
      required: [ 'values' ],
      additionalProperties: false
    },
    tags: [ 'ai-localize' ],
    kind: 'action',
    handler: '@apostrophecms/ai-localize:update'
  },
  {
    name: 'localize_add_widget',
    label: 'apostrophe:aiLocalizeToolAddWidget',
    description: 'Insert one widget into an area of the target copy, for ' +
      'a widget the source gained. "area" is the area\'s dot path (e.g. ' +
      '"main") or its _id from localize_read_outline; "position" is the ' +
      'index among the area\'s widgets, the end when omitted. Prefer ' +
      '"copyOf", the source widget\'s _id: the server copies it whole — ' +
      'images, links, settings and nested widgets included — still in the ' +
      'source language, and returns the copy\'s new _id; then translate ' +
      'its text with localize_update, reading the target with ' +
      'localize_read_text. Pass "widget" ("type" and its fields, ' +
      'translated) only to author a widget the source does not have.',
    input: {
      type: 'object',
      properties: {
        area: {
          type: 'string',
          minLength: 1
        },
        copyOf: {
          type: 'string',
          minLength: 1,
          description: 'The _id of the source widget to copy'
        },
        widget: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              minLength: 1
            }
          },
          required: [ 'type' ]
        },
        position: {
          type: 'integer',
          minimum: 0
        }
      },
      required: [ 'area' ],
      additionalProperties: false
    },
    tags: [ 'ai-localize' ],
    kind: 'action',
    handler: '@apostrophecms/ai-localize:addWidget'
  },
  {
    name: 'localize_remove_widget',
    label: 'apostrophe:aiLocalizeToolRemoveWidget',
    description: 'Remove one widget from the target copy, by its _id, for ' +
      'a widget the source lost. Never for a widget only the target has: ' +
      'that is work done in the target\'s language, and it stays.',
    input: {
      type: 'object',
      properties: {
        widgetId: {
          type: 'string',
          minLength: 1
        }
      },
      required: [ 'widgetId' ],
      additionalProperties: false
    },
    tags: [ 'ai-localize' ],
    kind: 'action',
    handler: '@apostrophecms/ai-localize:removeWidget'
  },
  {
    name: 'localize_finish',
    label: 'apostrophe:aiLocalizeToolFinish',
    description: 'Declare the target copy up to date with the source, ' +
      'which records this localization: the next one compares from here, ' +
      'and nothing changed before now is listed again. Call it last, and ' +
      'only once every source change is carried over. "summary" is one or ' +
      'two sentences for the editor, in the language you were told to ' +
      'use with them.',
    input: {
      type: 'object',
      properties: {
        summary: {
          type: 'string',
          minLength: 1
        }
      },
      required: [ 'summary' ],
      additionalProperties: false
    },
    tags: [ 'ai-localize' ],
    kind: 'action',
    handler: '@apostrophecms/ai-localize:finish'
  }
];

module.exports = (self) => {
  return {
    registerTools() {
      for (const tool of TOOLS) {
        self.apos.ai.addTool(tool);
      }
    },

    // How many parts a document's text comes in beyond one per field: the
    // extra reading and writing a long document takes, which a pass's step
    // budget makes room for
    extraParts(req, doc) {
      const manager = self.apos.doc.getManager(doc.type);
      const fields = [];
      collectText(self.apos, req, manager?.schema, doc, '', [], fields);
      return fields.reduce(
        (sum, entry) => sum + splitParts(entry.value, entry.format).length - 1,
        0
      );
    },

    // The tools of a pass: this module's, and the site's translation
    // service when one is registered (see `translator`) and the pass
    // translates
    toolNames({ translate = true } = {}) {
      const translator = translate ? self.translator() : null;
      return [
        ...TOOLS.map((tool) => tool.name),
        ...(translator ? [ translator.name ] : [])
      ];
    },

    // The site's translation service, when a module offers one to the
    // agent: a tool tagged "ai-localize-translate". The agent then decides
    // what to translate and where it goes, and leaves the wording to the
    // service — the same one the classic Localize flow translates with.
    // Without one, the agent translates on its own.
    //
    // The tool takes `{ from, to, texts: [ { text, html } ] }`, `from` and
    // `to` being locale names and `html` true for rich text markup, and
    // answers `{ translations: [ string ] }` in the same order. The first one
    // registered is used
    translator() {
      return self.apos.ai.getTools({ tags: 'ai-localize-translate' })[0] || null;
    },

    // The pass a tool call belongs to, refusing a call made outside one
    pass(req) {
      const pass = req.aposAiLocalize;
      if (!pass) {
        throw self.apos.error(
          'aiToolError',
          'this tool is only available during a localization'
        );
      }
      return pass;
    },

    // One copy of the pass, fetched fresh for the editor: the draft in its
    // locale, through the module that saves it
    async fetchCopy(req, copy) {
      const pass = self.pass(req);
      const _id = copy === 'source' ? pass.sourceId : pass.targetId;
      const locale = copy === 'source' ? pass.sourceLocale : pass.targetLocale;
      const draftReq = req.clone({
        mode: 'draft',
        locale
      });
      const found = await self.apos.doc.db.findOne(
        { _id },
        { projection: { type: 1 } }
      );
      const manager = found && self.apos.doc.getManager(found.type);
      const docModule = manager && self.docModuleFor(manager);
      const doc = docModule && await docModule.findOneForEditing(draftReq, { _id });
      if (!doc || !self.apos.ai.can(draftReq, copy === 'target' ? 'edit' : 'view', doc)) {
        throw self.apos.error(
          'aiToolError',
          `the ${copy} copy is not available to the current user`
        );
      }
      return {
        doc,
        manager,
        docModule,
        draftReq
      };
    },

    // Pages are fetched, patched and saved through the page module; pieces
    // through their own
    docModuleFor(manager) {
      return self.apos.instanceOf(manager, '@apostrophecms/page-type')
        ? self.apos.page
        : manager;
    },

    async readText(req, { copy, offset = 0 }) {
      const {
        doc, manager, draftReq
      } = await self.fetchCopy(req, copy);
      const fields = [];
      collectText(self.apos, draftReq, manager.schema, doc, '', [], fields);
      const entries = fields.flatMap((entry) => {
        const parts = splitParts(entry.value, entry.format);
        if (parts.length === 1) {
          return [ entry ];
        }
        return parts.map((part, index) => ({
          ...entry,
          address: `${entry.address}#${part.range}`,
          part: index + 1,
          parts: parts.length,
          value: part.value
        }));
      });
      const page = [];
      let size = 0;
      let index = offset;
      for (; index < entries.length; index++) {
        size += JSON.stringify(entries[index]).length;
        if (size > TEXT_MAX_CHARS && page.length) {
          break;
        }
        page.push(entries[index]);
      }
      return {
        copy,
        locale: doc.aposLocale.split(':')[0],
        title: doc.title || '',
        entries: page,
        ...(index < entries.length && { next: index })
      };
    },

    // Paged by item, an item being an area or one of its widgets; an area
    // that a page break splits is repeated on the next page with
    // "continued": true, its widgets keeping their positions
    async readOutline(req, { copy, offset = 0 }) {
      const { doc, draftReq } = await self.fetchCopy(req, copy);
      const items = [];
      self.apos.area.walk(doc, (area, dotPath) => {
        const header = {
          path: dotPath,
          _id: area._id
        };
        items.push({ area: header });
        (area.items || []).forEach((item, position) => {
          items.push({
            area: header,
            widget: {
              _id: item._id,
              type: item.type,
              label: draftReq.t(
                self.apos.area.getWidgetManager(item.type)?.label || item.type
              ),
              position,
              preview: widgetPreview(self.apos, item)
            }
          });
        });
      });
      const areas = [];
      let size = 0;
      let index = offset;
      for (; index < items.length; index++) {
        const item = items[index];
        size += JSON.stringify(item.widget || item.area).length;
        if (size > OUTLINE_MAX_CHARS && areas.length) {
          break;
        }
        if (areas.at(-1)?._id !== item.area._id) {
          areas.push({
            ...item.area,
            ...(item.widget && { continued: true }),
            widgets: []
          });
        }
        if (item.widget) {
          areas.at(-1).widgets.push(item.widget);
        }
      }
      return {
        copy,
        locale: doc.aposLocale.split(':')[0],
        type: doc.type,
        title: doc.title || '',
        areas,
        ...(index < items.length && { next: index })
      };
    },

    async readPaths(req, { copy, paths }) {
      const { doc } = await self.fetchCopy(req, copy);
      const pruned = self.apos.util.clonePermanent(doc);
      return {
        copy,
        values: paths.map((path) => {
          const value = valueAtPath(
            pruned,
            self.apos.util.resolveAtReference(pruned, path)
          );
          return {
            path,
            found: value !== undefined,
            value: value ?? null
          };
        })
      };
    },

    async widgetSchema(req, { type }) {
      const manager = self.apos.area.getWidgetManager(type);
      if (!manager) {
        throw self.apos.error('aiToolError', `unknown widget type "${type}"`);
      }
      return {
        type,
        // Rich text keeps its content outside its schema
        schema: (type === '@apostrophecms/rich-text'
          ? 'content: string (HTML)\n'
          : '') + schemaToCompact(manager.schema)
      };
    },

    async update(req, { values }) {
      const refused = Object.keys(values)
        .filter((key) => UNWRITABLE.includes(key.split(/[.#]/)[0]));
      if (refused.length) {
        throw self.apos.error(
          'aiToolError',
          `${refused.join(', ')} cannot be written by a localization`
        );
      }
      // Parts of long fields, by field
      const whole = {};
      const parts = new Map();
      for (const [ key, value ] of Object.entries(values)) {
        if (!isPartAddress(key)) {
          whole[key] = value;
          continue;
        }
        const parsed = parsePartAddress(key);
        if (!parsed) {
          throw self.apos.error('aiToolError', `"${key}" is not a valid part address`);
        }
        if (typeof value !== 'string') {
          throw self.apos.error('aiToolError', `"${key}" takes a string`);
        }
        if (!parts.has(parsed.address)) {
          parts.set(parsed.address, []);
        }
        parts.get(parsed.address).push({
          ...parsed,
          text: value
        });
      }
      const notes = [];
      await self.writeTarget(req, async ({
        doc, docModule, draftReq
      }) => {
        const patch = { ...whole };
        for (const [ address, writes ] of parts) {
          if (Object.hasOwn(whole, address)) {
            throw self.apos.error(
              'aiToolError',
              `"${address}" is written both whole and in parts`
            );
          }
          const { value, format } = self.textAt(doc, address);
          try {
            const spliced = spliceParts(value, format, writes);
            patch[address] = spliced.value;
            notes.push(...spliced.notes.map((note) => `${address}${note}`));
          } catch (e) {
            throw self.apos.error('aiToolError', `${address}: ${e.message}`);
          }
        }
        await applyPatch(self, docModule, draftReq, doc, patch);
      });
      return {
        written: Object.keys(values).length,
        ...(notes.length && { notes })
      };
    },

    // The text at an address of the target, with its format as
    // localize_read_text gives it: "html" for a rich text widget's content
    textAt(doc, address) {
      const path = self.apos.util.resolveAtReference(doc, address);
      const value = valueAtPath(doc, path);
      if (typeof value !== 'string') {
        throw self.apos.error(
          'aiToolError',
          `"${address}" is not a text of the target copy`
        );
      }
      const keys = path.split('.');
      const holder = valueAtPath(doc, keys.slice(0, -1).join('.'));
      const rich = keys.at(-1) === 'content' &&
        holder?.metaType === 'widget' &&
        self.apos.area.getWidgetManager(holder.type)?.getRichText;
      return {
        value,
        format: rich ? 'html' : 'text'
      };
    },

    async addWidget(req, {
      area: ref, copyOf, widget, position
    }) {
      if (Boolean(copyOf) === Boolean(widget)) {
        throw self.apos.error('aiToolError', 'give exactly one of "copyOf" or "widget"');
      }
      if (copyOf) {
        widget = await self.copySourceWidget(req, copyOf);
      }
      const widgetManager = self.apos.area.getWidgetManager(widget.type);
      if (!widgetManager) {
        throw self.apos.error('aiToolError', `unknown widget type "${widget.type}"`);
      }
      const widgetId = self.apos.util.generateId();
      let landed;
      await self.writeTarget(req, async ({
        doc, manager, docModule, draftReq
      }) => {
        const area = findArea(self.apos, doc, ref);
        let key;
        let items;
        if (area) {
          key = `@${area._id}`;
          items = [ ...(area.items || []) ];
        } else {
          // A never-edited area exists only in the schema; patching by its
          // field name creates it
          const field = manager.schema
            .find((field) => field.name === ref && field.type === 'area');
          if (!field) {
            throw self.apos.error(
              'aiToolError',
              `"${ref}" does not name an area of the target copy`
            );
          }
          key = ref;
          items = [];
        }
        landed = position === undefined
          ? items.length
          : Math.min(position, items.length);
        items.splice(landed, 0, {
          ...self.apos.schema.newInstance(widgetManager.schema),
          ...widget,
          _id: widgetId,
          metaType: 'widget'
        });
        await applyPatch(self, docModule, draftReq, doc, {
          [key]: {
            ...(area || { metaType: 'area' }),
            items
          }
        });
        // A widget the area refuses may be dropped by the conversion rather
        // than rejected; only its presence proves it was accepted
        if (!findWidget(self.apos, doc, widgetId)) {
          throw self.apos.error(
            'aiToolError',
            `the area "${ref}" did not accept a ${widget.type} widget`
          );
        }
      });
      return {
        widgetId,
        position: landed
      };
    },

    // A widget of the source, ready to insert into the target: loaded with
    // its relationships, each pointed at the related document's copy in the
    // target locale — the save looks them up by exact _id there, and drops
    // what it does not find — and with fresh ids for itself and everything
    // nested in it: areas, widgets, array items
    async copySourceWidget(req, widgetId) {
      const { targetLocale } = self.pass(req);
      const { doc } = await self.fetchCopy(req, 'source');
      const found = findWidget(self.apos, doc, widgetId);
      if (!found) {
        throw self.apos.error('aiToolError', `no widget "${widgetId}" in the source copy`);
      }
      // Plain data: dates in related documents turn into strings, which is
      // harmless, since a relationship saves only their ids
      const copy = JSON.parse(JSON.stringify(found.area.items[found.index]));
      const renew = (value) => {
        if (Array.isArray(value)) {
          value.forEach(renew);
        } else if (value && typeof value === 'object' && !(value instanceof Date)) {
          if ([ 'area', 'widget', 'arrayItem' ].includes(value.metaType)) {
            value._id = self.apos.util.generateId();
          }
          for (const [ key, child ] of Object.entries(value)) {
            if (!key.startsWith('_')) {
              renew(child);
            } else if (Array.isArray(child)) {
              for (const related of child) {
                const parts = typeof related?._id === 'string' && related._id.split(':');
                if (parts?.length === 3) {
                  related._id = `${parts[0]}:${targetLocale}:${parts[2]}`;
                }
              }
            }
          }
        }
      };
      renew(copy);
      return copy;
    },

    async removeWidget(req, { widgetId }) {
      await self.writeTarget(req, ({ doc }) => {
        const found = findWidget(self.apos, doc, widgetId);
        if (!found) {
          throw self.apos.error(
            'aiToolError',
            `no widget "${widgetId}" in the target copy`
          );
        }
        found.area.items.splice(found.index, 1);
      });
      return { removed: widgetId };
    },

    // The one write path: fetch the target for editing, change it, save it
    // through its own module. The pass's request carries `aposAi`, so
    // version history marks the save as the assistant's
    async writeTarget(req, mutate) {
      const target = await self.fetchCopy(req, 'target');
      await mutate(target);
      await target.docModule.update(target.draftReq, target.doc);
      self.pass(req).writes++;
    },

    async finish(req, { summary }) {
      const pass = self.pass(req);
      pass.finished = true;
      pass.summary = summary;
      return { recorded: true };
    }
  };
};

async function applyPatch(self, docModule, req, doc, values) {
  try {
    await docModule.applyPatch(req, doc, values);
  } catch (e) {
    throw self.apos.error(
      'aiToolError',
      `the values were rejected: ${convertDetail(e)}`
    );
  }
}

function convertDetail(error) {
  if (Array.isArray(error)) {
    return error
      .map((item) => `${item.path}: ${item.message || item.name}`)
      .join('; ');
  }
  return error.message || String(error);
}

// The translatable text of a document or a node of it, in schema order,
// depth first: string fields, and the markup of rich text widgets. Each
// entry carries the address the write tool takes — a top-level path, or
// "@<_id>" of the innermost widget or array item with the path inside it
function collectText(apos, req, schema, value, base, where, out) {
  for (const field of schema || []) {
    const fieldValue = value?.[field.name];
    const address = base ? `${base}.${field.name}` : field.name;
    const here = [ ...where, req.t(field.label || field.name) ];
    switch (field.type) {
      case 'string':
        if (typeof fieldValue === 'string' && fieldValue.trim()) {
          out.push({
            address,
            where: here.join(' › '),
            format: 'text',
            value: fieldValue
          });
        }
        break;
      case 'area':
        for (const widget of fieldValue?.items || []) {
          const manager = apos.area.getWidgetManager(widget.type);
          const widgetWhere = [ ...here, req.t(manager?.label || widget.type) ];
          const widgetAddress = `@${widget._id}`;
          if (typeof widget.content === 'string' && manager?.getRichText) {
            if (apos.util.htmlToPlaintext(widget.content).trim()) {
              out.push({
                address: `${widgetAddress}.content`,
                where: widgetWhere.join(' › '),
                format: 'html',
                value: widget.content
              });
            }
          }
          collectText(
            apos, req, manager?.schema, widget, widgetAddress, widgetWhere, out
          );
        }
        break;
      case 'array':
        for (const item of fieldValue || []) {
          collectText(apos, req, field.schema, item, `@${item._id}`, here, out);
        }
        break;
      case 'object':
        collectText(apos, req, field.schema, fieldValue, address, here, out);
        break;
      default:
        break;
    }
  }
}

function widgetPreview(apos, widget) {
  const text = typeof widget.content === 'string'
    ? apos.util.htmlToPlaintext(widget.content)
    : Object.values(widget).find((value) => typeof value === 'string' &&
      value.length > 3 && !/^[a-z0-9]{20,}$/.test(value)) || '';
  return text.replace(/\s+/g, ' ').trim().slice(0, 80);
}

function valueAtPath(object, path) {
  let value = object;
  for (const key of path.split('.')) {
    if (value === null || value === undefined) {
      return undefined;
    }
    value = value[key];
  }
  return value;
}

function findArea(apos, doc, ref) {
  const id = ref.startsWith('@') ? ref.slice(1) : ref;
  let match = null;
  apos.area.walk(doc, (area, dotPath) => {
    if (dotPath === ref || area._id === id) {
      match = area;
    }
  });
  return match;
}

function findWidget(apos, doc, widgetId) {
  let found = null;
  apos.area.walk(doc, (area) => {
    const index = (area.items || []).findIndex((item) => item._id === widgetId);
    if (index !== -1) {
      found = {
        area,
        index
      };
    }
  });
  return found;
}

// A schema as compact lines: "name: type* (details)", * marking required
function schemaToCompact(schema, indent = 0) {
  const pad = '  '.repeat(indent);
  return (schema || []).map((field) => {
    const details = [];
    if (field.withType) {
      details.push(`-> ${field.withType}`);
    }
    if (Array.isArray(field.choices)) {
      details.push(`[${field.choices.map((choice) => choice.value).join('|')}]`);
    }
    const widgets = Object.keys(field.options?.widgets || {});
    if (widgets.length) {
      details.push(`widgets: ${widgets.join(', ')}`);
    }
    if (field.schema?.length) {
      details.push(`{\n${schemaToCompact(field.schema, indent + 1)}\n${pad}}`);
    }
    return `${pad}${field.name}: ${field.type}${field.required ? '*' : ''}` +
      (details.length ? ` (${details.join(', ')})` : '');
  }).join('\n');
}
