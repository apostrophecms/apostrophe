// The change rows of a document as AI reads them, through its AI-facing
// schema, each at a path `update_document` takes as a key, and `get_changes`.

const _ = require('lodash');

// Characters of the result budget kept for the result's fields other than
// `rows` (`_id`, `title`, `since`, `next`)
const HEADROOM = 600;

const CHANGES = {
  added: 'added',
  modified: 'modified',
  deleted: 'removed',
  moved: 'moved'
};

module.exports = (self) => {
  return {
    async getChanges(req, {
      _id, since, requestId, offset
    }) {
      if (requestId && (since !== 'publication')) {
        throw self.apos.error('aiToolError', 'Give "since" or "requestId", not both.');
      }
      const {
        doc, manager, draftReq
      } = await self.findReadable(req, _id);
      const { rows, ...baseline } = requestId
        ? await getRequestRows()
        : await getDraftRows();
      const all = rows.flatMap(({ row, ...credit }) => {
        return self.renderChangeRow(draftReq, doc, row, credit);
      });
      // Rows are added while the result stays within the tool's budget
      const room = self.apos.ai.getTool('get_changes').maxResultChars - HEADROOM;
      const page = self.pageChangeRows(all, offset, room);
      return {
        _id: doc._id,
        type: doc.type,
        title: doc.title,
        locale: self.getLocaleOf(doc),
        ...baseline,
        rows: page.rows,
        ...((page.next !== undefined) && { next: page.next })
      };

      // Since publication or a version: the rows See Changes lists
      async function getDraftRows() {
        const { docVersions } = self.apos;
        if (!docVersions.hasDraftVersions(manager.options)) {
          throw self.apos.error('aiToolError', 'Documents of this type keep no draft ' +
            'history: they are live on save. Read a request\'s changes instead.');
        }
        if (!self.apos.ai.can(draftReq, 'edit', doc)) {
          throw self.apos.error('aiToolError', 'The user may not see the changes of this document.');
        }
        const version = (since !== 'publication') ? since : null;
        let changes;
        try {
          changes = await docVersions.getDraftChanges(draftReq, doc._id, {
            since: version
          });
        } catch (e) {
          if (version && [ 'notfound', 'invalid' ].includes(e.name)) {
            throw self.apos.error('aiToolError', `No version "${version}" of this ` +
              'document; get_document\'s versions list them.');
          }
          throw e;
        }
        const { baseline } = changes;
        return {
          ...((baseline.kind === 'version')
            ? {
              since: baseline.versionId,
              versionAt: baseline.at
            }
            : {
              since: 'publication',
              ...((baseline.kind === 'published')
                ? { publishedAt: baseline.at }
                : { neverPublished: true })
            }),
          rows: changes.rows.map(row => ({ row }))
        };
      }

      // The rows a request of this door recorded in the change log
      async function getRequestRows() {
        const door = self.getDoor(req);
        if (!door) {
          throw self.apos.error('aiToolError', 'A request\'s changes are read only within ' +
            'the chat or session that made them.');
        }
        const entries = await self.changes.find({
          requestId,
          docId: doc._id,
          ...(door.chat
            ? { chat: door.chat }
            : {
              door: door.door,
              userId: req.user?._id
            })
        })
          .sort({ sequence: 1 })
          .toArray();
        return {
          requestId,
          rows: entries.flatMap(entry => entry.rows.map(row => ({
            row,
            by: entry.userTitle,
            at: entry.at,
            ai: entry.ai
          })))
        };
      }
    },

    /**
     * A change row of Document Versions as AI reads it: the rows of
     * `get_changes` for it, each with the `update_document` key reaching the
     * value (`path`), the `change`, the values `before` and `after` through
     * the AI-facing schema, and an added widget's `place` in `doc`, as
     * `add_widgets` takes it. None for a value outside the AI-facing schema
     * or managed by the system.
     *
     * @param {object} req In draft mode, in the document's locale.
     * @param {object} doc The document the row is of, as it is now.
     * @param {object} row A row of Document Versions' change list.
     * @param {object} [credit] Who changed it (`by`), when (`at`) and AI's
     *   part in it as the model reads it (`ai`); what the row itself says
     *   when omitted.
     * @returns {object[]}
     */
    renderChangeRow(req, doc, row, {
      by = row.authors?.map(author => author.title).join(', '),
      at = row.changedAt,
      ai = getAi(row.ai)
    } = {}) {
      const manager = self.apos.doc.getManager(doc.type);
      const found = !row.system && locate(row.path);
      if (!found) {
        return [];
      }
      const meta = {
        ...(by && { by }),
        ...(at && { at }),
        ...(ai && { ai })
      };
      const change = getChange(row);
      const { key, widget } = found;
      if ([ 'area', 'array' ].includes(row.kind)) {
        return [ {
          path: key,
          change,
          before: row.old,
          after: row.new,
          ...meta
        } ];
      }
      if (row.type === 'moved') {
        return [ {
          path: key,
          change,
          from: locate(row.from.slice(0, -1))?.key,
          to: locate(row.path.slice(0, -1))?.key,
          ...meta
        } ];
      }
      if (row.kind === 'richText') {
        // The markup is the widget's shadow field of rich text, when AI sees it
        const field = getShadowFields(widget)
          .find(field => field.type === 'richText');
        return field
          ? [ {
            path: `${key}.${field.name}`,
            change,
            ...values(row.old, row.new),
            ...meta
          } ]
          : [];
      }
      if ((row.kind === 'widget') && (row.type === 'modified')) {
        return renderOutside();
      }
      const place = (row.kind === 'widget') && (row.type === 'added') && getPlace();
      return [ {
        path: key,
        change,
        ...values(project(row.old), project(row.new)),
        ...(place && { place }),
        ...meta
      } ];

      // Where an added widget is in the document, as add_widgets takes it:
      // the area, and the widget before it or the first position. None when
      // it is no longer there
      function getPlace() {
        const widgetId = row.path.at(-1).name;
        let items = null;
        self.apos.doc.walk(doc, (object, key, value) => {
          if (!items && (value?.metaType === 'area') &&
            value.items?.some(item => item?._id === widgetId)) {
            items = value.items;
          }
        });
        const area = items && locate(row.path.slice(0, -1))?.key;
        if (!area) {
          return null;
        }
        const index = items.findIndex(item => item._id === widgetId);
        return index
          ? {
            area,
            after: items[index - 1]._id
          }
          : {
            area,
            position: 0
          };
      }

      // A widget whose data outside its schema changed: a row for each of
      // its shadow fields that changed, else one saying only that it did,
      // since data no shadow field describes is the widget's own
      function renderOutside() {
        const changed = getShadowFields(widget).filter(field => {
          return !_.isEqual(row.old?.[field.name], row.new?.[field.name]);
        });
        if (!changed.length) {
          return [ {
            path: key,
            change: 'modified',
            note: 'Changed outside its fields.',
            ...meta
          } ];
        }
        return changed.map(field => ({
          path: `${key}.${field.name}`,
          change: 'modified',
          ...values(
            self.projectFields(req, [ field ], row.old || {})[field.name],
            self.projectFields(req, [ field ], row.new || {})[field.name]
          ),
          ...meta
        }));
      }

      // A value of the row as AI reads it
      function project(value) {
        if ((value === undefined) || (value === null)) {
          return value;
        }
        if (widget) {
          return self.projectWidget(req, value);
        }
        if (found.item) {
          return {
            _id: value._id,
            ...self.projectFields(req, found.item, value)
          };
        }
        if (row.kind === 'object') {
          return self.projectFields(req, found.field.schema, value);
        }
        return value;
      }

      function locate(path) {
        return self.locateChangePath(req, manager, path);
      }
    },

    /**
     * The rows of `renderChangeRow` from `offset` that fit in `room`
     * characters of a result, at least one: `{ rows, size, next }`, `next`
     * the offset of the first row left out, when there is one. A row too
     * large for any page keeps its path and change, and says so.
     *
     * @param {object[]} rows
     * @param {number} offset
     * @param {number} room
     * @returns {{ rows: object[], size: number, next?: number }}
     */
    pageChangeRows(rows, offset, room) {
      const page = [];
      let size = 0;
      let index = offset;
      for (; index < rows.length; index++) {
        const row = fit(rows[index], room);
        const rowSize = getSize(row);
        if (page.length && (size + rowSize > room)) {
          break;
        }
        page.push(row);
        size += rowSize;
      }
      return {
        rows: page,
        size,
        ...((index < rows.length) && { next: index })
      };
    },

    /**
     * Where a change row's `path` (Document Versions' segments) is in the
     * AI-facing schema of `manager`'s documents: `key`, the
     * `update_document` key reaching it, and the `field` it ends at, or the
     * `widget` (`{ manager, schema }`) or array `item` (its schema) it ends
     * at. `null` outside the AI-facing schema.
     *
     * @param {object} req
     * @param {object} manager The document's type manager.
     * @param {object[]} path
     * @returns {object|null}
     */
    locateChangePath(req, manager, path) {
      let schema = self.getAiSchemaOf(req, manager);
      let list = null;
      let key = '';
      let found = {};
      for (const segment of path) {
        if (list?.type === 'area') {
          const allowed = Object.keys(self.apos.area.getWidgets(list.options || {}));
          const widgetManager = allowed.includes(segment.widgetType) &&
            self.apos.area.getWidgetManager(segment.widgetType);
          if (!widgetManager || !segment.name) {
            return null;
          }
          schema = self.getAiSchemaOf(req, widgetManager);
          found = {
            widget: {
              manager: widgetManager,
              schema
            }
          };
        } else if (list?.type === 'array') {
          if (!segment.name) {
            return null;
          }
          schema = list.schema;
          found = { item: schema };
        } else {
          const field = schema.find(field => field.name === segment.name);
          if (!field) {
            return null;
          }
          key = key ? `${key}.${field.name}` : field.name;
          found = { field };
          list = [ 'area', 'array' ].includes(field.type) ? field : null;
          if (field.type === 'object') {
            schema = field.schema;
          }
          continue;
        }
        key = `@${segment.name}`;
        list = null;
      }
      return {
        key,
        ...found
      };
    },

    /**
     * A change row as `get_changes` names it, without its values: `{ path,
     * change }`, `path` the `update_document` key. A widget changed outside
     * its fields is named by the widget. `null` for a row AI doesn't read:
     * a system row, or one outside the AI-facing schema.
     *
     * @param {object} req
     * @param {object} manager The document's type manager.
     * @param {object} row
     * @returns {{ path: string, change: string }|null}
     */
    describeChangeRow(req, manager, row) {
      const found = !row.system && self.locateChangePath(req, manager, row.path);
      if (!found) {
        return null;
      }
      if (row.kind !== 'richText') {
        return {
          path: found.key,
          change: getChange(row)
        };
      }
      const field = getShadowFields(found.widget).find(field => field.type === 'richText');
      return field
        ? {
          path: `${found.key}.${field.name}`,
          change: getChange(row)
        }
        : null;
    }
  };
};

// The kind of change a row is, as AI reads it
function getChange(row) {
  return [ 'area', 'array' ].includes(row.kind) ? 'reordered' : CHANGES[row.type];
}

// The shadow fields of a widget its AI-facing schema keeps
function getShadowFields(widget) {
  return (widget?.schema || []).filter(field => field._shadow);
}

// `before` and `after` of a row, each only when that side has the value
function values(before, after) {
  return {
    ...((before !== undefined) && { before }),
    ...((after !== undefined) && { after })
  };
}

// AI's part in a change as the model reads it: `true` when AI changed it,
// `assisted` when an editor changed it after AI did
function getAi(ai) {
  if (ai === 'changed') {
    return true;
  }
  return (ai === 'assisted') ? 'assisted' : null;
}

// A row as it fits in `room`: one too large for any page keeps its path
// and change, its values read with get_document
function fit(row, room) {
  if (getSize(row) <= room) {
    return row;
  }
  const {
    before, after, ...rest
  } = row;
  return {
    ...rest,
    note: 'Too large to show here; get_document reads the value.'
  };
}

// The size of a row in a result, in characters
function getSize(row) {
  return JSON.stringify(row).length + 1;
}
