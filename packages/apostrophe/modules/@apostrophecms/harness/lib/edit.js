// The write tools' handlers. Every change is a patch built from the content
// as it is, nothing sends a whole area or document back. The patch builders
// take a root, the content of a document, a widget or an array item: a
// stored draft written through `writeDocuments`, or what an open editor
// holds, changed in memory by `editContent`.

const _ = require('lodash');
const { klona } = require('klona');

const MIXED_NOTICE = 'Changes with "published": true are live on the site now; the others ' +
  'are saved in drafts and go live when an editor publishes them.';
const EDITOR_NOTICE = 'The change is in the open editor, not saved; the user saves or ' +
  'cancels it.';

// Fields whose change is an action no tool takes, not a value: archiving,
// and changing a page's type, which converts the page to another schema
const ACTIONS = [ 'archived', 'type' ];

// The document tools whose change `editContent` makes in an open editor
const EDIT_ACTIONS = [ 'update_document', 'add_widgets', 'move_widgets', 'remove_widgets' ];

// Why a key or id a write names is refused, as the model reads it
const HINTS = {
  unknown: 'No field of that name here; the schema read lists them.',
  index: 'Array items and widgets are addressed as "@<id>".',
  area: 'An area changes through add_widgets, move_widgets and remove_widgets.',
  notfound: 'No widget or item with that id in this document; get_document lists them.',
  ambiguous: 'The id is held more than once in this document.',
  archived: 'The assistant doesn\'t archive or restore documents; an editor does.',
  type: 'The assistant doesn\'t change the type of a document; an editor does.',
  inside: 'A widget can\'t go into an area of its own or of another widget it moves with.',
  styles: 'Global Styles are not changed with update_document.'
};

// The hints of a widget or array item root, where only the root can change
// until its editor closes
const ROOT_HINTS = {
  widget: {
    unknown: 'No field of that name in the widget open in the editor; only it can change ' +
      'until its editor closes.',
    notfound: 'No widget or item with that id in the widget open in the editor; only it ' +
      'can change until its editor closes.',
    self: 'That is the widget open in the editor; it can\'t be moved or removed from ' +
      'inside it.'
  },
  item: {
    unknown: 'No field of that name in the item open in the editor; only it can change ' +
      'until its dialog closes.',
    notfound: 'No widget or item with that id in the item open in the editor; only it can ' +
      'change until its dialog closes.'
  }
};

module.exports = (self) => {
  return {
    async createPage(req, {
      type, title, target, position, locale, values
    }) {
      // A page named by id is found in its own locale
      const named = !target.startsWith('/') && await self.findReadable(req, target);
      const readReq = named
        ? named.draftReq
        : req.clone({
          mode: 'draft',
          ...(locale && { locale })
        });
      const findPage = criteria => self.apos.page.find(readReq, criteria)
        .areas(false)
        .relationships(false)
        .toObject();
      const found = await findPage(named ? { _id: named.doc._id } : { slug: target });
      if (!found) {
        throw self.apos.error('aiToolError', `No page "${target}" the user can read in the ` +
          `locale ${readReq.locale}; get_page_tree lists the pages.`);
      }
      const sibling = [ 'before', 'after' ].includes(position);
      if (sibling && !found.level) {
        throw self.apos.error('aiToolError', 'The home page has no pages beside it; create ' +
          'the page under it.');
      }
      const parent = sibling
        ? await findPage({ path: self.apos.page.getParentPath(found) })
        : found;
      if (!parent) {
        throw self.apos.error('aiToolError', `The user can't read the page "${found.title}" ` +
          'is under.');
      }
      if (!self.apos.page.allowedChildTypes(parent).includes(type)) {
        throw self.apos.error('aiToolError', `A "${type}" page can't go under "${parent.title}".`);
      }
      const result = await self.createDocument(req, {
        type,
        title,
        values,
        parent,
        target: found,
        position
      });
      return getWriteResult(result);
    },

    async createPiece(req, {
      type, title, locale, values
    }) {
      const result = await self.createDocument(
        locale ? req.clone({ locale }) : req,
        {
          type,
          title,
          values
        }
      );
      return getWriteResult(result);
    },

    async updateDocument(req, { targets }) {
      const result = await self.writeDocuments(req, targets.map(({ _id, values }) => ({
        _id,
        patch: (doc, manager, draftReq) => {
          if (self.apos.instanceOf(manager, '@apostrophecms/styles')) {
            throw refuse([ {
              path: '_id',
              name: 'styles'
            } ]);
          }
          return buildUpdate(draftReq, indexDocument(draftReq, doc), values).patches;
        }
      })));
      return getWriteResult(result);
    },

    async addWidgets(req, {
      _id, area, widgets, position, before, after
    }) {
      checkPlace({
        position,
        before,
        after
      });
      let added = [];
      const result = await self.writeDocuments(req, [ {
        _id,
        patch: (doc, manager, draftReq) => {
          const built = buildAdd(draftReq, indexDocument(draftReq, doc), {
            area,
            widgets,
            position,
            before,
            after
          });
          added = built.widgets;
          return built.patches;
        }
      } ]);
      return getWriteResult(result, doc => ({
        area,
        widgets: locate(indexDocument(req, doc), added)
      }));
    },

    async moveWidgets(req, {
      _id, widgets, area, position, before, after
    }) {
      checkPlace({
        position,
        before,
        after
      });
      let moved = [];
      const result = await self.writeDocuments(req, [ {
        _id,
        patch: (doc, manager, draftReq) => {
          const built = buildMove(draftReq, indexDocument(draftReq, doc), {
            widgets,
            area,
            position,
            before,
            after
          });
          moved = built.widgets;
          return built.patches;
        }
      } ]);
      return getWriteResult(result, doc => ({
        area,
        widgets: locate(indexDocument(req, doc), moved)
      }));
    },

    async removeWidgets(req, { _id, widgets }) {
      const result = await self.writeDocuments(req, [ {
        _id,
        patch: (doc, manager, draftReq) => {
          return buildRemove(indexDocument(draftReq, doc), widgets).patches;
        }
      } ]);
      return getWriteResult(result, () => ({ removed: widgets }));
    },

    /**
     * Changes what an open editor holds, in memory: the patch a document
     * tool would write, built on the root's content, applied and converted
     * as a save would, and refused when conversion would drop anything it
     * supplies. Nothing is saved; the caller hands `values` to the editor.
     * The caller checks that AI may work with the root's document.
     *
     * @param {object} req
     * @param {object} root See `getContentRoot`.
     * @param {object} operation `action`, one of `update_document`,
     *   `add_widgets`, `move_widgets` and `remove_widgets`, with that tool's
     *   arguments without `_id` (`targets` becomes the root's `values`).
     *   Keys and paths are relative to the root; a widget or item root's own
     *   fields are also accepted as `@<root id>.<field>`.
     * @returns {Promise<{ values: object, touched: string[], removed:
     *   string[], result: object }>} `values`: the whole new value of every
     *   top-level field of the root the change reaches. `touched`: the keys
     *   it wrote, a field's (`title`, `seo.title`, `@<id>.title`) or a
     *   widget's or item's whole (`@<id>`). `removed`: the widgets it
     *   removed. `result`: the tool's result, `saved: false`; a refused
     *   change has only `result`'s `refused` and nothing else.
     */
    async editContent(req, root, { action, ...args }) {
      if (!EDIT_ACTIONS.includes(action)) {
        throw self.apos.error('invalid', `"${action}" changes nothing.`);
      }
      const opened = self.getContentRoot(req, root);
      const content = indexContent(opened.req, opened);
      const header = opened.header;
      let built;
      let value;
      try {
        built = build();
      } catch (e) {
        return refused(e, path => path);
      }
      try {
        value = await applyToRoot(opened, built.patches);
      } catch (e) {
        return refused(e, fromHolder);
      }
      const names = built.tops.includes(null)
        ? opened.schema.map(field => field.name)
        : [ ...new Set(built.tops) ];
      // Where added or moved widgets landed, as the document tools say it
      const extra = built.widgets
        ? {
          area: args.area,
          widgets: locate(indexContent(opened.req, {
            ...opened,
            value
          }), built.widgets)
        }
        : (built.removed && { removed: built.removed });
      return {
        values: Object.fromEntries(names
          .filter(name => Object.hasOwn(value, name))
          .map(name => [ name, value[name] ])),
        touched: built.touched,
        removed: built.removed || [],
        result: {
          written: [ {
            ...header,
            ...extra
          } ],
          saved: false,
          notice: EDITOR_NOTICE
        }
      };

      function build() {
        if ([ 'add_widgets', 'move_widgets' ].includes(action)) {
          checkPlace({
            position: args.position,
            before: args.before,
            after: args.after
          });
        }
        switch (action) {
          case 'update_document':
            return buildUpdate(opened.req, content, args.values);
          case 'add_widgets':
            return buildAdd(opened.req, content, args);
          case 'move_widgets':
            return buildMove(opened.req, content, args);
          default:
            return buildRemove(content, args.widgets);
        }
      }

      // The result of a change refused with `e`, each field it names by
      // `toPath`; any error but a refusal stops the call
      function refused(e, toPath) {
        const error = Array.isArray(e)
          ? self.apos.error('invalid', { errors: e })
          : e;
        if (error?.name !== 'invalid') {
          throw e;
        }
        const refusal = self.describeRefusal(error);
        return {
          values: {},
          touched: [],
          removed: [],
          result: {
            refused: [ {
              ...header,
              ...refusal,
              ...(refusal.fields && {
                fields: refusal.fields.map(field => ({
                  ...field,
                  path: toPath(field.path)
                }))
              })
            } ],
            saved: false
          }
        };
      }

      // A path conversion names through the holder of a widget or item root
      // (see `applyToRoot`), as the root names it: by index or id in the
      // holder's area or array
      function fromHolder(path) {
        if (opened.kind === 'document') {
          return path;
        }
        const rootId = opened.value._id;
        const holder = new RegExp(`^root(\\.items)?\\.(0|${_.escapeRegExp(rootId)})(\\.|$)`);
        const rest = path.replace(holder, '');
        return (rest === path) ? path : (rest || `@${rootId}`);
      }
    },

    /**
     * The content of an open editor as the harness reads and changes it:
     * a document, a widget or an array item, with the AI-facing schema of
     * its fields. Throws `invalid` for a root it can't place.
     *
     * @param {object} req
     * @param {object} root
     * @param {string} root.kind `document`, `widget` or `item`.
     * @param {object} root.data What the editor holds: the document, a
     *   never-saved one included, the widget, or the item.
     * @param {string} [root.locale] The editor's locale; that of `req`
     *   when omitted.
     * @param {string} [root.areaFieldId] A widget's: the field id of the
     *   area holding it, whose options its conversion takes.
     * @param {string} [root.fieldId] An item's: the field id of its array.
     * @returns {{ kind: string, req: object, schema: object[], value: object,
     *   header: object, manager?: object, field?: object }} `req` in draft
     *   mode in the editor's locale; `header` names the root in results;
     *   `manager` is a document's type, `field` the area or array field a
     *   widget or item is converted in.
     */
    getContentRoot(req, {
      kind, data, locale, areaFieldId, fieldId
    }) {
      const rootReq = req.clone({
        mode: 'draft',
        ...(locale && { locale })
      });
      const value = (data && (typeof data === 'object')) ? data : null;
      const header = {
        ...(value?._id && { _id: value._id }),
        locale: rootReq.locale
      };
      if (kind === 'document') {
        const manager = self.apos.doc.getManager(value?.type);
        if (!manager) {
          throw self.apos.error('invalid', 'The document has no type.');
        }
        return {
          kind,
          req: rootReq,
          schema: self.getAiSchemaOf(rootReq, manager),
          value,
          manager,
          header: {
            ...header,
            type: value.type,
            ...(value.title && { title: value.title })
          }
        };
      }
      if (kind === 'widget') {
        const manager = self.apos.area.getWidgetManager(value?.type);
        const area = self.apos.schema.getFieldById(areaFieldId);
        const options = (area?.type === 'area') &&
          self.apos.area.getWidgets(area.options || {})[value?.type];
        if (!manager || !options || !value._id) {
          throw self.apos.error('invalid', 'The widget is no widget of its area.');
        }
        return {
          kind,
          req: rootReq,
          schema: self.getAiSchemaOf(rootReq, manager),
          value,
          field: {
            name: 'root',
            type: 'area',
            options: { widgets: { [value.type]: options } }
          },
          header: {
            ...header,
            type: value.type
          }
        };
      }
      if (kind === 'item') {
        const field = findAiField(rootReq, fieldId);
        if ((field?.type !== 'array') || !value?._id) {
          throw self.apos.error('invalid', 'The item is no item of an array AI reads.');
        }
        return {
          kind,
          req: rootReq,
          schema: field.schema,
          value,
          // Only what converts the item: the array's limits and conditions
          // are the document's
          field: {
            _id: field._id,
            name: 'root',
            type: 'array',
            schema: field.schema
          },
          header: {
            ...header,
            field: field.name
          }
        };
      }
      throw self.apos.error('invalid', `No content root of kind "${kind}".`);
    }
  };

  // The tool result of a write: each document written with where it landed,
  // and what `extra(doc)` adds for the tool, the refused ones with their
  // reason, and the sentence the model repeats
  function getWriteResult({ written, refused }, extra = () => ({})) {
    const published = new Set(written.map(item => item.published));
    return {
      written: written.map(({
        doc, notice, ...item
      }) => ({
        ...item,
        ...extra(doc)
      })),
      ...(refused.length && { refused }),
      ...(written.length && {
        notice: (published.size > 1) ? MIXED_NOTICE : written[0].notice
      })
    };
  }

  // An `invalid` error naming `errors`, `{ path, name }` each, with the hint
  // the model reads, the root's own where `content` has one
  function refuse(errors, content = null) {
    const hints = {
      ...HINTS,
      ...ROOT_HINTS[content?.kind]
    };
    return self.apos.error('invalid', {
      errors: errors.map(error => ({
        ...error,
        hint: hints[error.name]
      }))
    });
  }

  /**
   * The patch of `update_document` for `values` on `content` (see
   * `indexContent`), with the keys it writes (`touched`) and the top-level
   * fields of the root they reach (`tops`, `null` for the root whole).
   */
  function buildUpdate(req, content, values) {
    const patch = {};
    const touched = [];
    const tops = [];
    // Objects the root never stored, by key: a patch can't set a field in
    // them, so each is written whole with every value given
    const absent = new Map();
    const errors = [];
    for (const [ key, value ] of Object.entries(values)) {
      const target = resolve(content, key);
      const isArea = (target.field?.type === 'area') || (target.node?.kind === 'area');
      const action = (content.kind === 'document') && ACTIONS.includes(key) && key;
      const error = action || target.error || (isArea && 'area');
      if (error) {
        errors.push({
          path: key,
          name: error
        });
        continue;
      }
      tops.push(target.top);
      if (target.node?.root) {
        // The root whole: each of its fields, its own `_id` kept
        const replaced = newValueAt(req, target, value);
        for (const field of content.schema) {
          patch[field.name] = replaced[field.name];
          touched.push(field.name);
        }
        continue;
      }
      touched.push(target.node?.key || target.key);
      if (target.absent) {
        const { field, names } = target.absent;
        const object = absent.get(target.absent.key) || {
          field,
          value: {}
        };
        _.set(object.value, names, value);
        absent.set(target.absent.key, object);
      } else {
        patch[target.node?.key || target.key] = newValueAt(req, target, value);
      }
    }
    if (errors.length) {
      throw refuse(errors, content);
    }
    for (const [ key, { field, value } ] of absent) {
      patch[key] = self.newValue(req, field, value);
    }
    return {
      patches: [ patch ],
      touched,
      tops
    };
  }

  // The patch of `add_widgets` on `content`, with the new `widgets`
  function buildAdd(req, content, {
    area, widgets, position, before, after
  }) {
    const target = findArea(content, area);
    const added = widgets.map(widget => self.newWidget(req, widget).widget);
    return {
      patches: [
        place(target, added, getPlace(content, target, [], {
          position,
          before,
          after
        }))
      ],
      widgets: added,
      touched: added.map(widget => `@${widget._id}`),
      tops: [ target.top ]
    };
  }

  // The patches of `move_widgets` on `content`, with the moved `widgets`
  function buildMove(req, content, {
    widgets, area, position, before, after
  }) {
    const nodes = findWidgets(content, widgets);
    const target = findArea(content, area);
    const errors = nodes
      .filter(node => nodes.some(other => node.within.includes(other.value._id)))
      .map(node => ({
        path: `@${node.value._id}`,
        name: 'inside'
      }));
    if (target.within.some(id => widgets.includes(id))) {
      errors.push({
        path: area,
        name: 'inside'
      });
    }
    if (errors.length) {
      throw refuse(errors, content);
    }
    const moved = nodes.map(node => node.value);
    return {
      // The widgets are the root's own content: whatever a save heals in
      // them is healed, as when an editor moves them
      patches: [
        { $pullAllById: getPulls(nodes) },
        {
          ...place(target, moved, getPlace(content, target, widgets, {
            position,
            before,
            after
          })),
          _lossless: false
        }
      ],
      widgets: moved,
      touched: moved.map(widget => `@${widget._id}`),
      tops: [ ...nodes.map(node => node.top), target.top ]
    };
  }

  // The patch of `remove_widgets` on `content`
  function buildRemove(content, widgets) {
    const nodes = findWidgets(content, widgets);
    // A widget inside another one removed goes with it
    const outer = nodes.filter(node => !nodes.some(other => {
      return node.within.includes(other.value._id);
    }));
    return {
      patches: [ { $pullAllById: getPulls(outer) } ],
      removed: widgets,
      touched: [],
      tops: outer.map(node => node.top)
    };
  }

  // `content` (see `indexContent`) of a stored draft
  function indexDocument(req, doc) {
    const manager = self.apos.doc.getManager(doc.type);
    return indexContent(req, {
      kind: 'document',
      schema: self.getAiSchemaOf(req, manager),
      value: doc
    });
  }

  /**
   * What AI can address in a root (see `getContentRoot`), through the
   * AI-facing schema: every widget, array item, object and area holding an
   * `_id`, by `_id`, and a widget or item root itself (`root: true`, its
   * `key` empty). Each node has its `kind`, its `key` (where a patch finds
   * it), its stored `value`, the `schema` of its own fields, the `_id`s of
   * the widgets and items it is `within`, the root's field it is under
   * (`top`); an area node its `field` and `widgets` (those AI sees, in
   * order), a widget its `area` node.
   */
  function indexContent(req, {
    kind, schema, value
  }) {
    const ids = new Map();
    if (kind !== 'document') {
      add(value._id, {
        kind,
        root: true,
        key: '',
        value,
        schema,
        within: [],
        top: null
      });
    }
    walk(schema, value, '', [], null);
    return {
      kind,
      schema,
      value,
      ids
    };

    function walk(schema, value, key, within, top) {
      for (const field of schema) {
        const fieldKey = key ? `${key}.${field.name}` : field.name;
        const fieldTop = top || field.name;
        const given = value?.[field.name];
        if (field.type === 'area') {
          walkArea(field, given, fieldKey, within, fieldTop);
        } else if ((field.type === 'array') && Array.isArray(given)) {
          given.forEach((item, index) => {
            const itemKey = item?._id ? `@${item._id}` : `${fieldKey}.${index}`;
            add(item?._id, {
              kind: 'item',
              key: itemKey,
              value: item,
              schema: field.schema,
              within,
              top: fieldTop
            });
            walk(
              field.schema,
              item,
              itemKey,
              [ ...within, item?._id ].filter(Boolean),
              fieldTop
            );
          });
        } else if ((field.type === 'object') && given && (typeof given === 'object')) {
          add(given._id, {
            kind: 'object',
            key: fieldKey,
            value: given,
            schema: field.schema,
            within,
            top: fieldTop
          });
          walk(field.schema, given, fieldKey, within, fieldTop);
        }
      }
    }

    function walkArea(field, area, key, within, top) {
      const allowed = Object.keys(self.apos.area.getWidgets(field.options || {}));
      const node = {
        kind: 'area',
        key,
        value: area,
        field,
        widgets: [],
        within,
        top
      };
      add(area?._id, node);
      for (const widget of area?.items || []) {
        const manager = allowed.includes(widget?.type) &&
          self.apos.area.getWidgetManager(widget.type);
        if (!manager) {
          continue;
        }
        const schema = self.getAiSchemaOf(req, manager);
        const widgetNode = {
          kind: 'widget',
          key: `@${widget._id}`,
          value: widget,
          schema,
          area: node,
          within,
          top
        };
        node.widgets.push(widget);
        add(widget._id, widgetNode);
        walk(schema, widget, `@${widget._id}`, [ ...within, widget._id ], top);
      }
      return node;
    }

    function add(_id, node) {
      if (_id) {
        ids.set(_id, [ ...(ids.get(_id) || []), node ]);
      }
    }
  }

  /**
   * What a key of `update_document` or an area path names in `content`
   * (see `indexContent`): `{ node }` for `@<id>` alone, `{ field, value,
   * key }` for a field reached by name, dot path or `@<id>.` path, `value`
   * being what it stores, `key` where a patch finds it; `{ error }` when it
   * names nothing AI can address. Each but an error has `top`, the root's
   * field it is under, `null` for the root whole. A field inside an object
   * the root never stored has `absent`: that object's `key` and `field`,
   * and the `names` from it to the field.
   */
  function resolve(content, key) {
    let names = key.split('.');
    let schema = content.schema;
    let value = content.value;
    let base = '';
    let top = null;
    if (key.startsWith('@')) {
      const nodes = content.ids.get(names[0].slice(1)) || [];
      if (nodes.length !== 1) {
        return { error: nodes.length ? 'ambiguous' : 'notfound' };
      }
      const [ node ] = nodes;
      names = names.slice(1);
      if (!names.length) {
        return {
          node,
          top: node.top
        };
      }
      if (node.kind === 'area') {
        return { error: 'area' };
      }
      schema = node.schema;
      value = node.value;
      base = node.key;
      top = node.top;
    }
    let absent = null;
    for (const [ index, name ] of names.entries()) {
      const field = schema.find(field => field.name === name);
      if (!field) {
        return { error: /^\d+$/.test(name) ? 'index' : 'unknown' };
      }
      value = value?.[name];
      base = base ? `${base}.${name}` : name;
      top ||= name;
      if (index === names.length - 1) {
        return {
          field,
          value,
          key: base,
          top,
          ...(absent && { absent })
        };
      }
      if (field.type !== 'object') {
        return { error: (field.type === 'area') ? 'area' : 'index' };
      }
      if (!absent && (!value || (typeof value !== 'object'))) {
        absent = {
          key: base,
          field,
          names: names.slice(index + 1)
        };
      }
      schema = field.schema;
    }
  }

  // The value of `update_document` for `target` (see `resolve`), a new
  // instance where it replaces a widget, item or object whole
  function newValueAt(req, target, value) {
    const { node, field } = target;
    if (node?.kind === 'widget') {
      return self.newWidget(req, {
        type: node.value.type,
        ...value
      }, { _id: node.value._id }).widget;
    }
    if (node) {
      return self.newItem(req, node.schema, value, { _id: node.value._id });
    }
    return self.newValue(req, field, value);
  }

  // The area node at `path`: a field reached as `resolve` does, or an area
  // by `@<id>`. Throws a refusal naming `path` otherwise
  function findArea(content, path) {
    const target = resolve(content, path);
    if (target.node?.kind === 'area') {
      return target.node;
    }
    if (target.field?.type === 'area') {
      // An area the root holds is indexed; one it never stored isn't
      return (target.value?._id && content.ids.get(target.value._id)?.[0]) || {
        kind: 'area',
        key: target.key,
        value: target.value,
        field: target.field,
        widgets: [],
        within: getWithin(content, path),
        top: target.top
      };
    }
    throw refuse([ {
      path,
      name: target.error || 'unknown'
    } ], content);
  }

  // The widgets and items an area path is inside of, by its leading `@<id>`
  function getWithin(content, path) {
    if (!path.startsWith('@')) {
      return [];
    }
    const [ node ] = content.ids.get(path.split('.')[0].slice(1)) || [];
    if (!node || node.root) {
      return [];
    }
    return [ ...node.within, node.value._id ];
  }

  // The widget nodes of `ids`; a refusal naming every id that is no widget
  // AI sees in the root, or that is the root itself
  function findWidgets(content, ids) {
    const errors = [];
    const nodes = [];
    for (const _id of ids) {
      const found = content.ids.get(_id) || [];
      if ((found.length === 1) && found[0].root) {
        errors.push({
          path: `@${_id}`,
          name: (found[0].kind === 'widget') ? 'self' : 'notfound'
        });
      } else if ((found.length === 1) && (found[0].kind === 'widget')) {
        nodes.push(found[0]);
      } else {
        errors.push({
          path: `@${_id}`,
          name: (found.length > 1) ? 'ambiguous' : 'notfound'
        });
      }
    }
    if (errors.length) {
      throw refuse(errors, content);
    }
    return nodes;
  }

  // `$pullAllById` of widget nodes, by the key of their area's items
  function getPulls(nodes) {
    const pulls = {};
    for (const node of nodes) {
      const key = `${node.area.key}.items`;
      pulls[key] = [ ...(pulls[key] || []), node.value._id ];
    }
    return pulls;
  }

  // Where among the widgets of `area` new ones go, as `$push` takes it:
  // before the widget at `position` (counting the widgets AI sees, those in
  // `leaving` left out), before or after a widget, or at the end. A
  // refusal when the widget named isn't one of the area's
  function getPlace(content, area, leaving, {
    position, before, after
  }) {
    const staying = area.widgets.filter(widget => !leaving.includes(widget._id));
    const neighbour = before ?? after;
    if (neighbour !== undefined) {
      if (!staying.some(widget => widget._id === neighbour)) {
        throw refuse([ {
          path: before ? 'before' : 'after',
          name: 'notfound'
        } ], content);
      }
      return before ? { $before: before } : { $after: after };
    }
    const next = (position !== undefined) && staying[position];
    return next ? { $before: next._id } : {};
  }

  // A patch putting `widgets` into `area` at `where`: a `$push`, or the area
  // whole when the root never stored it, since there is nothing to push
  // into. An area of a widget or item root's own is reached through the
  // root, by `@<root id>`, where `applyToRoot` finds it
  function place(area, widgets, where) {
    if (!Array.isArray(area.value?.items)) {
      return {
        [area.key]: {
          _id: area.value?._id || self.apos.util.generateId(),
          metaType: 'area',
          items: widgets
        }
      };
    }
    return {
      $push: {
        [`${area.key}.items`]: {
          $each: widgets,
          ...where
        }
      }
    };
  }

  // `{ _id, type, index }` of each of `widgets` in `content` as written,
  // `index` counting the widgets AI sees in its area
  function locate(content, widgets) {
    return widgets.map(({ _id, type }) => {
      const [ node ] = content.ids.get(_id) || [];
      return {
        _id,
        type,
        ...(node?.area && {
          index: node.area.widgets.findIndex(widget => widget._id === _id)
        })
      };
    });
  }

  // Refuses a place given more than one way
  function checkPlace(place) {
    const given = Object.keys(place).filter(name => place[name] !== undefined);
    if (given.length > 1) {
      throw self.apos.error('aiToolError', `Give one of ${given.map(name => `"${name}"`).join(', ')}.`);
    }
  }

  // The root's value with `patches` applied and converted as a save would,
  // each lossless unless it says otherwise, the root left as it is. A
  // document goes through its type's own patch; a widget or an item is held
  // as the only entry of an area or array of its own field, so core's patch
  // operators reach it by `@<id>` and conversion takes it as a save does
  async function applyToRoot(opened, patches) {
    const { req, kind } = opened;
    if (kind === 'document') {
      const doc = klona(opened.value);
      const isPage = self.apos.instanceOf(opened.manager, '@apostrophecms/page-type');
      if (isPage) {
        // A never-saved page has no ancestors yet
        doc._ancestors ||= [];
      }
      for (const patch of patches) {
        const input = {
          _lossless: true,
          ...klona(patch)
        };
        if (isPage) {
          await self.apos.page.applyPatch(req, doc, input);
        } else {
          await opened.manager.applyPatch(req, doc, input);
        }
      }
      return doc;
    }
    const value = klona(opened.value);
    const holder = {
      _id: self.apos.util.generateId(),
      root: (kind === 'widget')
        ? {
          _id: self.apos.util.generateId(),
          metaType: 'area',
          items: [ value ]
        }
        : [ value ]
    };
    for (const patch of patches) {
      const input = throughRoot(klona(patch), value._id);
      const lossless = input._lossless !== false;
      const drops = lossless ? [] : undefined;
      const patchPaths = lossless ? [] : undefined;
      self.apos.schema.implementPatchOperators(input, holder, { patchPaths });
      const schema = self.apos.schema.subsetSchemaForPatch([ opened.field ], input);
      await self.apos.schema.convert(req, schema, input, holder, { drops });
      if (lossless) {
        self.apos.schema.checkLosslessPatch(req, holder, drops, patchPaths);
      }
    }
    return (kind === 'widget') ? holder.root.items[0] : holder.root[0];
  }

  // `patch` with the keys of the root's own fields reached through the
  // root, by `@<rootId>`
  function throughRoot(patch, rootId) {
    const prefix = key => ('@$'.includes(key.charAt(0)) ? key : `@${rootId}.${key}`);
    const result = {};
    for (const [ key, value ] of Object.entries(patch)) {
      if (key === '_lossless') {
        result[key] = value;
      } else if (key.startsWith('$')) {
        result[key] = _.mapKeys(value, (operand, name) => prefix(name));
      } else {
        result[prefix(key)] = value;
      }
    }
    return result;
  }

  // The field of `fieldId` in the AI-facing schema of the doc or widget type
  // its id starts with, followed down through arrays and objects
  function findAiField(req, fieldId) {
    const [ metaType, type ] = String(fieldId || '').split('.');
    const manager = (metaType === 'doc')
      ? self.apos.doc.getManager(type)
      : ((metaType === 'widget') && self.apos.area.getWidgetManager(type));
    return manager ? find(self.getAiSchemaOf(req, manager)) : null;

    function find(schema) {
      for (const field of schema) {
        if (field._id === fieldId) {
          return field;
        }
        const found = [ 'array', 'object' ].includes(field.type) && find(field.schema || []);
        if (found) {
          return found;
        }
      }
      return null;
    }
  }
};
