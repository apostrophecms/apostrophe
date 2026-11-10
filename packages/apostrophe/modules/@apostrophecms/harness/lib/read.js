// The read tools' handlers: find content, read it compactly, learn its types.
// Every read is in draft mode, as the user, through the AI-facing schema, and
// names the locale it read.

const PREVIEW_CHARS = 80;
// Characters of the page tree's result budget kept for the result's fields
// other than `pages` (`locale`, `truncated`)
const TREE_HEADROOM = 200;

module.exports = (self) => {
  return {
    async searchContent(req, {
      query, type, locale, limit, offset
    }) {
      if (!query && !type) {
        throw self.apos.error('aiToolError', 'Give a "query", a "type", or both.');
      }
      const readReq = req.clone({
        mode: 'draft',
        ...(locale && { locale })
      });
      let cursor = self.apos.doc.find(readReq, {
        type: type || { $in: self.getDocTypeNames() }
      });
      cursor = query ? cursor.search(query) : cursor.sort({ updatedAt: -1 });
      const page = await cursor
        .project({
          _id: 1,
          type: 1
        })
        .skip(offset)
        .limit(limit + 1)
        .toArray();
      const found = page.slice(0, limit);
      // Each type's own query adds its URLs
      const byType = Map.groupBy(found, doc => doc.type);
      const docs = [];
      for (const [ name, matches ] of byType) {
        docs.push(...await self.apos.doc.getManager(name)
          .find(readReq, { _id: { $in: matches.map(doc => doc._id) } })
          .areas(false)
          .relationships(false)
          .toArray());
      }
      return {
        locale: readReq.locale,
        results: self.apos.util.orderById(found.map(doc => doc._id), docs)
          .map(doc => ({
            _id: doc._id,
            type: doc.type,
            title: doc.title,
            ...(doc.slug && { slug: doc.slug }),
            ...(doc._url && { url: doc._url })
          })),
        ...((page.length > limit) && { next: offset + limit })
      };
    },

    async getDocument(req, {
      _id, view, paths, before
    }) {
      const {
        doc, manager, draftReq
      } = await self.findReadable(req, _id);
      const header = await self.getReadHeader(draftReq, doc);
      if (view === 'versions') {
        return {
          ...header,
          ...await getVersions()
        };
      }
      const projected = self.projectDocument(draftReq, doc);
      if (view === 'properties') {
        if (!paths) {
          throw self.apos.error('aiToolError', 'Name the "paths" to read; the outline lists the fields and areas.');
        }
        return {
          ...header,
          properties: paths.map(path => {
            const value = self.apos.util.get(projected, path, {
              ignoreDynamicProperties: true
            });
            return (value === undefined)
              ? {
                path,
                missing: true
              }
              : {
                path,
                value
              };
          })
        };
      }
      const outline = self.getOutline(draftReq, manager, projected);
      if (!paths) {
        return {
          ...header,
          ...outline
        };
      }
      return {
        ...header,
        parts: paths.map(path => findPart(outline.areas, path) || {
          path,
          missing: true
        })
      };

      // The area at `path`, or the widget `@<_id>` with the areas below it
      function findPart(areas, path) {
        for (const area of areas) {
          if (area.path === path) {
            return area;
          }
          for (const widget of area.widgets) {
            if (`@${widget._id}` === path) {
              return {
                path,
                widget
              };
            }
            const found = findPart(widget.areas || [], path);
            if (found) {
              return found;
            }
          }
        }
        return null;
      }

      async function getVersions() {
        const versions = self.apos.docVersions;
        if (!self.apos.ai.can(draftReq, 'edit', doc)) {
          throw self.apos.error('aiToolError', 'The user may not see the version history of this document.');
        }
        if (!versions.isVersioned(doc)) {
          return {
            versions: [],
            note: 'Documents of this type keep no version history.'
          };
        }
        const date = before ? new Date(before) : null;
        if (date && isNaN(date)) {
          throw self.apos.error('aiToolError', '"before" must be the "next" of an earlier versions read.');
        }
        const page = await versions.getTimelinePage(
          draftReq,
          versions.getTimelineCriteria(doc),
          {
            before: date,
            consolidate: true,
            forbidden: versions.getForbiddenFieldNames(draftReq, manager)
          }
        );
        return {
          versions: page.results.map(version => ({
            versionId: version._id,
            at: version.updatedAt || version.createdAt,
            by: version.author,
            ai: version.ai,
            ...((version.mode === 'published') && { published: true }),
            changes: version.changeCount,
            ...(version.restoredFrom && { restoredFrom: version.restoredFrom._id })
          })),
          ...(page.next && { next: page.next })
        };
      }
    },

    /**
     * The outline of a projected document (see `projectDocument`): the
     * size of every field that is not an area, with its value when it is a
     * short string, number or boolean, and every area with its widgets,
     * each widget with a short text preview, its size and the areas below
     * it. An area's `path` addresses it as `update_document`
     * and `add_widgets` do: its field name, or `@<_id>.<field>` below the
     * nearest item with an `_id`.
     *
     * @param {object} req
     * @param {object} manager The document's type manager.
     * @param {object} projected
     * @returns {{ chars: number, fields: object[], areas: object[] }}
     */
    getOutline(req, manager, projected) {
      const schema = self.getAiSchemaOf(req, manager);
      const fields = schema
        .filter(field => (field.type !== 'area') && (field.name in projected))
        .map(field => {
          const value = projected[field.name];
          const short = [ 'string', 'number', 'boolean' ].includes(typeof value) &&
            (String(value).length <= PREVIEW_CHARS);
          return {
            name: field.name,
            chars: getSize(value),
            ...(short && { value })
          };
        });
      const areas = [];
      collectAreas(schema, projected, '', areas);
      return {
        chars: getSize(projected),
        fields,
        areas
      };

      function collectAreas(schema, value, base, areas) {
        for (const field of schema) {
          const path = base ? `${base}.${field.name}` : field.name;
          const given = value?.[field.name];
          if (field.type === 'area') {
            areas.push({
              path,
              widgets: (given?.items || []).map(outlineWidget)
            });
          } else if ((field.type === 'array') && Array.isArray(given)) {
            for (const item of given) {
              collectAreas(field.schema, item, `@${item._id}`, areas);
            }
          } else if ((field.type === 'object') && given) {
            collectAreas(field.schema, given, path, areas);
          }
        }
      }

      function outlineWidget(widget) {
        const manager = self.apos.area.getWidgetManager(widget.type);
        const schema = self.getAiSchemaOf(req, manager);
        const areas = [];
        collectAreas(schema, widget, `@${widget._id}`, areas);
        const preview = getPreview(schema, widget);
        return {
          _id: widget._id,
          type: widget.type,
          ...(preview && { preview }),
          chars: getSize(widget),
          ...(areas.length && { areas })
        };
      }

      // The widget's first text, else the titles of its first relationship
      function getPreview(schema, widget) {
        const texts = schema
          .filter(field => [ 'string', 'richText' ].includes(field.type))
          .map(field => widget[field.name]);
        const text = texts.find(value => (typeof value === 'string') && value.trim());
        const related = schema
          .filter(field => field.type === 'relationship')
          .map(field => widget[field.name])
          .find(value => value?.some?.(item => item.title));
        const preview = text
          ? self.apos.util.htmlToPlaintext(text)
          : related?.map(item => item.title).filter(Boolean).join(', ');
        if (!preview) {
          return null;
        }
        const flat = preview.replace(/\s+/g, ' ').trim();
        return (flat.length > PREVIEW_CHARS)
          ? `${flat.slice(0, PREVIEW_CHARS)}…`
          : flat;
      }
    },

    async listTypes(req) {
      const piecePages = await getPiecePages();
      const pages = [];
      const pieces = [];
      for (const name of self.getDocTypeNames()) {
        const manager = self.apos.doc.getManager(name);
        const isPage = self.apos.instanceOf(manager, '@apostrophecms/page-type');
        if (!isPage && !self.apos.instanceOf(manager, '@apostrophecms/piece-type')) {
          continue;
        }
        const type = {
          name,
          label: self.translate(req, manager.options.label || name),
          publishing: self.getPublishing(name)
        };
        if (isPage) {
          pages.push(type);
        } else {
          pieces.push({
            ...type,
            pages: piecePages.get(name) || []
          });
        }
      }
      return {
        pages,
        pieces,
        widgets: self.getWidgetTypeNames().map(name => ({
          name,
          label: self.translate(
            req,
            self.apos.area.getWidgetManager(name).options.label || name
          )
        }))
      };

      // The slugs of the pages that give each piece type its URLs
      async function getPiecePages() {
        const pieceTypes = new Map();
        for (const [ name, manager ] of Object.entries(self.apos.doc.managers)) {
          if (self.apos.instanceOf(manager, '@apostrophecms/piece-page-type') &&
            manager.pieces) {
            pieceTypes.set(name, manager.pieces.name);
          }
        }
        const slugs = new Map();
        if (!pieceTypes.size) {
          return slugs;
        }
        const found = await self.apos.page
          .find(req.clone({ mode: 'draft' }), { type: { $in: [ ...pieceTypes.keys() ] } })
          .areas(false)
          .relationships(false)
          .project({
            type: 1,
            slug: 1
          })
          .toArray();
        for (const page of found) {
          const type = pieceTypes.get(page.type);
          slugs.set(type, [ ...(slugs.get(type) || []), page.slug ]);
        }
        return slugs;
      }
    },

    async getSchema(req, { types, fields }) {
      if (fields && (types.length > 1)) {
        throw self.apos.error('aiToolError', 'Read "fields" of one type at a time.');
      }
      const legend = new Set();
      const markup = new Map();
      const lines = [];
      for (const type of types) {
        const doc = self.apos.doc.getManager(type);
        const widget = self.apos.area.getWidgetManager(type);
        if (doc) {
          const kind = self.apos.instanceOf(doc, '@apostrophecms/page-type') ? 'page' : 'piece';
          lines.push(`# ${type} (${kind})`, ...await self.renderSchema(req, doc, {
            legend,
            markup,
            fields
          }));
        }
        if (widget) {
          lines.push(`# ${type} (widget)`, ...await self.renderSchema(req, widget, {
            legend,
            markup,
            fields
          }));
        }
      }
      return {
        legend: self.getSchemaLegend(legend, markup),
        schema: lines.join('\n')
      };
    },

    async getGuidance(req, { types }) {
      return {
        guidance: types.map(type => ({
          type,
          aiHow: self.getTypeOptions(type).aiHow || null
        }))
      };
    },

    async getPageTree(req, {
      root, depth, locale
    }) {
      // A root named by id is read in its own locale
      const named = root && !root.startsWith('/') && await self.findReadable(req, root);
      const readReq = named
        ? named.draftReq
        : req.clone({
          mode: 'draft',
          ...(locale && { locale })
        });
      const start = named
        ? { _id: named.doc._id }
        : (root ? { slug: root } : { level: 0 });
      const top = await self.apos.page.find(readReq, start)
        .areas(false)
        .relationships(false)
        .children({
          depth: depth + 1,
          // Pages kept out of navigation are still pages
          orphan: null,
          areas: false,
          relationships: false
        })
        .toObject();
      if (!top) {
        throw self.apos.error('aiToolError', root
          ? `No page "${root}" the user can read in the locale ${readReq.locale}.`
          : `No home page the user can read in the locale ${readReq.locale}.`);
      }
      const allowed = self.getDocTypeNames();
      // Pages are added while the result stays within the tool's budget
      const room = self.apos.ai.getTool('get_page_tree').maxResultChars - TREE_HEADROOM;
      const pages = [];
      let size = 0;
      let truncated = false;
      collect(top, null);
      return {
        locale: readReq.locale,
        pages,
        ...(truncated && { truncated })
      };

      function collect(page, parentId) {
        // A type AI may not read takes its branch with it
        if (!allowed.includes(page.type)) {
          return;
        }
        const children = page._children || [];
        const row = {
          _id: page._id,
          title: page.title,
          slug: page.slug,
          type: page.type,
          level: page.level,
          parentId,
          children: children.length
        };
        const rowSize = getSize(row) + 1;
        if (truncated || (size + rowSize > room)) {
          truncated = true;
          return;
        }
        pages.push(row);
        size += rowSize;
        if (page.level - top.level >= depth) {
          truncated = truncated || (children.length > 0);
          return;
        }
        for (const child of children) {
          collect(child, page._id);
        }
      }
    },

    async findReferences(req, {
      _id, limit, offset
    }) {
      const { doc, draftReq } = await self.findReadable(req, _id);
      const ids = doc.relatedReverseIds || [];
      const referrers = () => self.apos.doc.find(draftReq, {
        aposDocId: { $in: ids },
        type: { $in: self.getDocTypeNames() }
      })
        .areas(false)
        .relationships(false);
      const total = ids.length ? await referrers().toCount() : 0;
      const found = total
        ? await referrers().sort({ _id: 1 }).skip(offset).limit(limit).toArray()
        : [];
      return {
        ...await self.getReadHeader(draftReq, doc),
        total,
        references: found.map(referrer => ({
          _id: referrer._id,
          type: referrer.type,
          title: referrer.title,
          paths: getPaths(referrer)
        })),
        ...((offset + found.length < total) && { next: offset + found.length })
      };

      // Where `referrer` holds the document, as `update_document` keys
      function getPaths(referrer) {
        const paths = [];
        const manager = self.apos.doc.getManager(referrer.type);
        walk(self.getAiSchemaOf(draftReq, manager), referrer, '');
        return paths;

        function walk(schema, value, base) {
          for (const field of schema) {
            const path = base ? `${base}.${field.name}` : field.name;
            const given = value?.[field.name];
            if (field.type === 'relationship') {
              if ((value?.[field.idsStorage] || []).includes(doc.aposDocId)) {
                paths.push(path);
              }
            } else if (field.type === 'area') {
              for (const widget of given?.items || []) {
                const widgetManager = self.apos.area.getWidgetManager(widget?.type);
                if (widgetManager) {
                  walk(self.getAiSchemaOf(draftReq, widgetManager), widget, `@${widget._id}`);
                }
              }
            } else if ((field.type === 'array') && Array.isArray(given)) {
              for (const item of given) {
                walk(field.schema, item, `@${item._id}`);
              }
            } else if ((field.type === 'object') && given) {
              walk(field.schema, given, path);
            }
          }
        }
      }
    },

    // The draft `findDraft` finds, when AI may read it; a tool error the
    // model can act on otherwise
    async findReadable(req, _id) {
      try {
        const found = await self.findDraft(req, _id);
        if (self.apos.ai.can(found.draftReq, 'view', found.doc)) {
          return found;
        }
      } catch (e) {
        if (e.name !== 'notfound') {
          throw e;
        }
      }
      throw self.apos.error(
        'aiToolError',
        `No document "${_id}" the user can read. Ids come from search_content, ` +
          'get_page_tree or an earlier read.'
      );
    },

    // What every document read starts with: `_id`, `type`, `title`, the
    // `locale` read, and `locales`, every locale the document exists in
    async getReadHeader(req, doc) {
      const locale = self.getLocaleOf(doc);
      const locales = locale && (Object.keys(self.apos.i18n.locales).length > 1)
        ? await self.apos.doc.find(req, {
          aposDocId: doc.aposDocId,
          aposMode: 'draft'
        })
          .locale(null)
          .areas(false)
          .relationships(false)
          .project({ aposLocale: 1 })
          .toArray()
        : [];
      return {
        _id: doc._id,
        type: doc.type,
        title: doc.title,
        locale,
        ...(locales.length && {
          locales: locales.map(self.getLocaleOf).sort()
        })
      };
    },

    // The options of a doc or widget type
    getTypeOptions(type) {
      return (self.apos.doc.getManager(type) || self.apos.area.getWidgetManager(type))
        ?.options || {};
    },

    // `text` as the model reads it: an i18n key or plain text, translated
    // into the language the admin UI shows `req`, never through `req.t`
    translate(req, text) {
      return self.apos.i18n.i18next.t(text, {
        lng: self.apos.i18n.getAdminLocale(req)
      });
    }
  };
};

// The size of a value as the model reads it, in characters
function getSize(value) {
  return JSON.stringify(value)?.length || 0;
}
