// The tools an AI localization pass works with. Each pass is bound to one
// pair of copies — the source document in its locale, its copy in the target
// locale — carried on the request as `req.aposAiLocalize` by the run that
// starts the pass (see lib/run.js). So no tool takes a document id: a read
// names "source" or "target", and every write lands on the target. The model
// cannot reach any other document, whatever it is asked.
//
// Every handler acts as the editor who started the localization, and reads
// and writes as every AI tool does: through the schema AI reads a type by
// (see `apos.harness.getAiSchemaOf`), so a field kept away from AI is neither
// shown to the model nor written by it, and on the harness's write path (see
// `writeTarget`).

const {
  splitParts, isPartAddress, parsePartAddress, spliceParts
} = require('./parts');

// Budgets for a read, in characters of the serialized result. Reads that
// could exceed them come in pages, and long fields in parts (see parts.js),
// so a long document is never too much to handle, just more calls. The
// module's `textPageChars` and `outlinePageChars` options can only lower the
// page sizes below these
const TEXT_MAX_CHARS = 60000;
const DOC_MAX_CHARS = 50000;
const OUTLINE_MAX_CHARS = 20000;

// Properties a write may never set: identity, the page tree's coordinates
// and the URL, which stays the editor's call
const UNWRITABLE = [
  '_id', 'aposDocId', 'aposLocale', 'aposMode', 'type', 'archived', 'slug',
  'path', 'level', 'rank', 'parkedId', 'metaType'
];

// Why a write was refused, as the model of a pass reads it
const REFUSALS = {
  unknown: 'no such field',
  index: 'array items and widgets are addressed as "@<_id>"',
  area: 'an area changes through localize_add_widget and localize_remove_widget',
  notfound: 'no widget or item with that _id',
  ambiguous: 'that _id is held more than once',
  notFound: 'no such document in the target locale',
  readOnly: 'the field is read-only',
  limit: 'more items than the field takes'
};

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
      collectText(self, req, manager && aiSchema(self, req, manager), doc, '', [], fields);
      return fields.reduce(
        (sum, entry) => sum + self.splitParts(entry).length - 1,
        0
      );
    },

    // One text entry of localize_read_text in parts, at the configured size
    splitParts(entry) {
      return splitParts(entry.value, entry.format, self.options.partMaxChars);
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
      collectText(self, draftReq, aiSchema(self, draftReq, manager), doc, '', [], fields);
      const entries = fields.flatMap((entry) => {
        const parts = self.splitParts(entry);
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
        if (size > Math.min(self.options.textPageChars, TEXT_MAX_CHARS) && page.length) {
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
      const {
        doc, manager, draftReq
      } = await self.fetchCopy(req, copy);
      const items = [];
      for (const {
        path, area, widgets
      } of collectAreas(self, draftReq, manager, doc)) {
        const header = {
          path,
          _id: area._id
        };
        items.push({ area: header });
        widgets.forEach((item, position) => {
          items.push({
            area: header,
            widget: {
              _id: item._id,
              type: item.type,
              label: draftReq.t(
                self.apos.area.getWidgetManager(item.type).label || item.type
              ),
              position,
              preview: widgetPreview(self, draftReq, item)
            }
          });
        });
      }
      const areas = [];
      let size = 0;
      let index = offset;
      const budget = Math.min(self.options.outlinePageChars, OUTLINE_MAX_CHARS);
      for (; index < items.length; index++) {
        const item = items[index];
        size += JSON.stringify(item.widget || item.area).length;
        if (size > budget && areas.length) {
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
      const { doc, draftReq } = await self.fetchCopy(req, copy);
      // As AI reads the document, which is also how the write tools take
      // a value
      const shown = self.apos.harness.projectDocument(draftReq, doc);
      return {
        copy,
        values: paths.map((path) => {
          const value = valueAtPath(
            shown,
            self.apos.util.resolveAtReference(shown, path)
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
        schema: schemaToCompact(aiSchema(self, req, manager))
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
      await self.writeTarget(req, async ({ doc, draftReq }) => {
        const patch = { ...whole };
        // A part goes into the text as stored
        const stored = parts.size && await self.storedDraft(doc._id);
        for (const [ address, writes ] of parts) {
          if (Object.hasOwn(whole, address)) {
            throw self.apos.error(
              'aiToolError',
              `"${address}" is written both whole and in parts`
            );
          }
          const { value, format } = self.textAt(stored, address);
          try {
            const spliced = spliceParts(value, format, writes);
            patch[address] = spliced.value;
            notes.push(...spliced.notes.map((note) => `${address}${note}`));
          } catch (e) {
            throw self.apos.error('aiToolError', `${address}: ${e.message}`);
          }
        }
        return self.apos.harness.getToolPatches(draftReq, doc, {
          action: 'update_document',
          values: patch
        }).patches;
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
      const { harness } = self.apos;
      const source = copyOf && await self.fetchCopy(req, 'source');
      const copied = source &&
        findWidget(self, source.draftReq, source.manager, source.doc, copyOf);
      if (source && !copied) {
        throw self.apos.error('aiToolError', `no widget "${copyOf}" in the source copy`);
      }
      const type = copied ? copied.widget.type : widget.type;
      if (!self.apos.area.getWidgetManager(type)) {
        throw self.apos.error('aiToolError', `unknown widget type "${type}"`);
      }
      let widgetId;
      const saved = await self.writeTarget(req, ({
        doc, manager, draftReq
      }) => {
        const found = collectAreas(self, draftReq, manager, doc)
          .find(({ path, area }) => (path === ref) || (area._id === ref.replace(/^@/, '')));
        // A never-edited area exists only in the schema, under its name
        const field = found?.field || aiSchema(self, draftReq, manager)
          .find((field) => (field.name === ref) && (field.type === 'area'));
        if (!field) {
          throw self.apos.error(
            'aiToolError',
            `"${ref}" does not name an area of the target copy`
          );
        }
        if (!Object.hasOwn(self.apos.area.getWidgets(field.options || {}), type)) {
          throw self.apos.error(
            'aiToolError',
            `the area "${ref}" did not accept a ${type} widget`
          );
        }
        const made = harness.getToolPatches(draftReq, doc, {
          area: found ? `@${found.area._id}` : ref,
          position,
          ...(source
            ? {
              action: 'copy_widgets',
              from: source.doc,
              widgets: [ copyOf ]
            }
            : {
              action: 'add_widgets',
              widgets: [ widget ]
            })
        });
        widgetId = made.widgets[0]._id;
        // A copy is the source's own content: what a save heals in it is
        // healed, such as a relationship to a document the target locale
        // doesn't have, as when an editor copies the widget
        return source
          ? made.patches.map((patch) => ({
            ...patch,
            _lossless: false
          }))
          : made.patches;
      });
      const manager = self.apos.doc.getManager(saved.type);
      return {
        widgetId,
        position: findWidget(self, req, manager, saved, widgetId)?.position
      };
    },

    async removeWidget(req, { widgetId }) {
      await self.writeTarget(req, ({ doc, draftReq }) => {
        return self.apos.harness.getToolPatches(draftReq, doc, {
          action: 'remove_widgets',
          widgets: [ widgetId ]
        }).patches;
      });
      return { removed: widgetId };
    },

    // The one write path, the harness's (see `apos.harness.writeDraft`):
    // the editor's right to edit the target, its lock held while it is
    // written, a save that drops nothing the patches supply and is marked
    // as AI's in version history. `getPatches` returns the patches for the
    // target as it is (see `apos.harness.getToolPatches`). Returns the saved
    // draft. What the model can act on is a tool error; a target another
    // editor has open throws `locked`, which ends the pass
    async writeTarget(req, getPatches) {
      const pass = self.pass(req);
      const { harness } = self.apos;
      try {
        const found = await harness.findDraft(req, pass.targetId);
        const saved = await harness.writeDraft(found, async ({
          doc, manager, draftReq, save
        }) => {
          return save(await getPatches({
            doc,
            manager,
            draftReq
          }));
        });
        pass.writes++;
        return saved;
      } catch (e) {
        // Conversion throws its field errors as an array
        const error = Array.isArray(e) ? self.apos.error('invalid', { errors: e }) : e;
        if ([ 'notfound', 'forbidden' ].includes(error.name)) {
          throw self.apos.error(
            'aiToolError',
            'the target copy is not available to the current user'
          );
        }
        if (error.name !== 'invalid') {
          throw e;
        }
        const { message, fields = [] } = harness.describeRefusal(error);
        throw self.apos.error('aiToolError', 'the write was refused: ' + (fields.length
          ? fields
            .map(({ path, reason }) => `${path}: ${REFUSALS[reason] || reason}`)
            .join('; ')
          : message));
      }
    },

    async finish(req, { summary }) {
      const pass = self.pass(req);
      pass.finished = true;
      pass.summary = summary;
      return { recorded: true };
    }
  };
};

// The schema AI reads and writes a doc or widget type through
function aiSchema(self, req, manager) {
  return self.apos.harness.getAiSchemaOf(req, manager);
}

// The widgets of an area AI reads: those of a type the area allows that
// still has a module
function widgetsOf(self, field, area) {
  const allowed = Object.keys(self.apos.area.getWidgets(field.options || {}));
  return (area?.items || []).filter((widget) => {
    return allowed.includes(widget?.type) && self.apos.area.getWidgetManager(widget.type);
  });
}

// The translatable text of a document or a node of it, as AI reads it: in
// schema order, depth first, string fields and the markup rich text widgets
// keep beside their fields. Each entry carries the address the write tool
// takes: a top-level path, or "@<_id>" of the innermost widget or array item
// with the path inside it
function collectText(self, req, schema, value, base, where, out) {
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
      case 'richText':
        // Named by its widget alone
        if (typeof fieldValue === 'string' &&
          self.apos.util.htmlToPlaintext(fieldValue).trim()) {
          out.push({
            address,
            where: where.join(' › '),
            format: 'html',
            value: fieldValue
          });
        }
        break;
      case 'area':
        for (const widget of widgetsOf(self, field, fieldValue)) {
          const manager = self.apos.area.getWidgetManager(widget.type);
          collectText(
            self,
            req,
            aiSchema(self, req, manager),
            widget,
            `@${widget._id}`,
            [ ...here, req.t(manager.label || widget.type) ],
            out
          );
        }
        break;
      case 'array':
        for (const item of fieldValue || []) {
          collectText(self, req, field.schema, item, `@${item._id}`, here, out);
        }
        break;
      case 'object':
        collectText(self, req, field.schema, fieldValue, address, here, out);
        break;
      default:
        break;
    }
  }
}

// Every area a document stores that AI reads, in schema order, depth first:
// `{ path, area, field, widgets }`, `path` its dot path in the document and
// `widgets` those AI reads in it (see `widgetsOf`)
function collectAreas(self, req, manager, doc) {
  const out = [];
  walk(aiSchema(self, req, manager), doc, '');
  return out;

  function walk(schema, value, base) {
    for (const field of schema || []) {
      const fieldValue = value?.[field.name];
      const path = base ? `${base}.${field.name}` : field.name;
      if ((field.type === 'area') && (fieldValue?.metaType === 'area')) {
        const widgets = widgetsOf(self, field, fieldValue);
        out.push({
          path,
          area: fieldValue,
          field,
          widgets
        });
        for (const widget of widgets) {
          walk(
            aiSchema(self, req, self.apos.area.getWidgetManager(widget.type)),
            widget,
            `${path}.items.${fieldValue.items.indexOf(widget)}`
          );
        }
      } else if ((field.type === 'array') && Array.isArray(fieldValue)) {
        fieldValue.forEach((item, index) => walk(field.schema, item, `${path}.${index}`));
      } else if ((field.type === 'object') && fieldValue) {
        walk(field.schema, fieldValue, path);
      }
    }
  }
}

// A widget AI reads in a document, by its _id: `{ widget, position }`, its
// place among the widgets AI reads in its area
function findWidget(self, req, manager, doc, widgetId) {
  for (const { widgets } of collectAreas(self, req, manager, doc)) {
    const position = widgets.findIndex((widget) => widget._id === widgetId);
    if (position !== -1) {
      return {
        widget: widgets[position],
        position
      };
    }
  }
  return null;
}

// The first text AI reads in a widget, cut short
function widgetPreview(self, req, widget) {
  const manager = self.apos.area.getWidgetManager(widget.type);
  const text = aiSchema(self, req, manager)
    .filter((field) => [ 'string', 'richText' ].includes(field.type))
    .map((field) => ((field.type === 'richText')
      ? self.apos.util.htmlToPlaintext(widget[field.name] || '')
      : widget[field.name] || ''))
    .find((value) => (typeof value === 'string') && value.trim().length > 3) || '';
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
    // Rich text keeps its markup beside its fields
    const type = (field.type === 'richText') ? 'string (HTML)' : field.type;
    return `${pad}${field.name}: ${type}${field.required ? '*' : ''}` +
      (details.length ? ` (${details.join(', ')})` : '');
  }).join('\n');
}
