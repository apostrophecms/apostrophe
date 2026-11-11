// The write tools' handlers. Every change is a patch built from the draft as
// it is, written through `writeDocuments`; nothing sends a whole area or
// document back.

const _ = require('lodash');

const MIXED_NOTICE = 'Changes with "published": true are live on the site now; the others ' +
  'are saved in drafts and go live when an editor publishes them.';

// Fields whose change is an action no tool takes, not a value: archiving,
// and changing a page's type, which converts the page to another schema
const ACTIONS = [ 'archived', 'type' ];

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
          const content = indexContent(draftReq, doc);
          const patch = {};
          // Objects the document never stored, by key: a patch can't set a
          // field in them, so each is written whole with every value given
          const absent = new Map();
          const errors = [];
          for (const [ key, value ] of Object.entries(values)) {
            const target = resolve(content, key);
            const isArea = (target.field?.type === 'area') || (target.node?.kind === 'area');
            const error = (ACTIONS.includes(key) && key) ||
              target.error ||
              (isArea && 'area');
            if (error) {
              errors.push({
                path: key,
                name: error
              });
            } else if (target.absent) {
              const { field, names } = target.absent;
              const object = absent.get(target.absent.key) || {
                field,
                value: {}
              };
              _.set(object.value, names, value);
              absent.set(target.absent.key, object);
            } else {
              patch[key] = newValueAt(draftReq, target, value);
            }
          }
          if (errors.length) {
            throw refuse(errors);
          }
          for (const [ key, { field, value } ] of absent) {
            patch[key] = self.newValue(draftReq, field, value);
          }
          return patch;
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
          const content = indexContent(draftReq, doc);
          const target = findArea(content, area);
          added = widgets.map(widget => self.newWidget(draftReq, widget).widget);
          return place(target, added, getPlace(target, [], {
            position,
            before,
            after
          }));
        }
      } ]);
      return getWriteResult(result, doc => ({
        area,
        widgets: locate(req, doc, added)
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
          const content = indexContent(draftReq, doc);
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
            throw refuse(errors);
          }
          moved = nodes.map(node => node.value);
          // The widgets are the document's own content: whatever a save
          // heals in them is healed, as when an editor moves them
          return [
            { $pullAllById: getPulls(nodes) },
            {
              ...place(target, moved, getPlace(target, widgets, {
                position,
                before,
                after
              })),
              _lossless: false
            }
          ];
        }
      } ]);
      return getWriteResult(result, doc => ({
        area,
        widgets: locate(req, doc, moved)
      }));
    },

    async removeWidgets(req, { _id, widgets }) {
      const result = await self.writeDocuments(req, [ {
        _id,
        patch: (doc, manager, draftReq) => {
          const nodes = findWidgets(indexContent(draftReq, doc), widgets);
          // A widget inside another one removed goes with it
          const outer = nodes.filter(node => !nodes.some(other => {
            return node.within.includes(other.value._id);
          }));
          return { $pullAllById: getPulls(outer) };
        }
      } ]);
      return getWriteResult(result, () => ({ removed: widgets }));
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
  // the model reads
  function refuse(errors) {
    return self.apos.error('invalid', {
      errors: errors.map(error => ({
        ...error,
        hint: HINTS[error.name]
      }))
    });
  }

  /**
   * What AI can address in a stored draft, through the AI-facing schema:
   * every widget, array item, object and area holding an `_id`, by `_id`.
   * Each node has its `kind`, its `key` (where a patch finds it), its stored
   * `value`, the `schema` of its own fields, the `_id`s of the widgets and
   * items it is `within`; an area node its `field` and `widgets` (those AI
   * sees, in order), a widget its `area` node.
   */
  function indexContent(req, doc) {
    const manager = self.apos.doc.getManager(doc.type);
    const schema = self.getAiSchemaOf(req, manager);
    const ids = new Map();
    walk(schema, doc, '', []);
    return {
      schema,
      doc,
      ids
    };

    function walk(schema, value, key, within) {
      for (const field of schema) {
        const fieldKey = key ? `${key}.${field.name}` : field.name;
        const given = value?.[field.name];
        if (field.type === 'area') {
          walkArea(field, given, fieldKey, within);
        } else if ((field.type === 'array') && Array.isArray(given)) {
          given.forEach((item, index) => {
            const itemKey = item?._id ? `@${item._id}` : `${fieldKey}.${index}`;
            add(item?._id, {
              kind: 'item',
              key: itemKey,
              value: item,
              schema: field.schema,
              within
            });
            walk(field.schema, item, itemKey, [ ...within, item?._id ].filter(Boolean));
          });
        } else if ((field.type === 'object') && given && (typeof given === 'object')) {
          add(given._id, {
            kind: 'object',
            key: fieldKey,
            value: given,
            schema: field.schema,
            within
          });
          walk(field.schema, given, fieldKey, within);
        }
      }
    }

    function walkArea(field, area, key, within) {
      const allowed = Object.keys(self.apos.area.getWidgets(field.options || {}));
      const node = {
        kind: 'area',
        key,
        value: area,
        field,
        widgets: [],
        within
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
          within
        };
        node.widgets.push(widget);
        add(widget._id, widgetNode);
        walk(schema, widget, `@${widget._id}`, [ ...within, widget._id ]);
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
   * names nothing AI can address. A field inside an object the document
   * never stored has `absent`: that object's `key` and `field`, and the
   * `names` from it to the field.
   */
  function resolve(content, key) {
    let names = key.split('.');
    let schema = content.schema;
    let value = content.doc;
    let base = '';
    if (key.startsWith('@')) {
      const nodes = content.ids.get(names[0].slice(1)) || [];
      if (nodes.length !== 1) {
        return { error: nodes.length ? 'ambiguous' : 'notfound' };
      }
      const [ node ] = nodes;
      names = names.slice(1);
      if (!names.length) {
        return { node };
      }
      if (node.kind === 'area') {
        return { error: 'area' };
      }
      schema = node.schema;
      value = node.value;
      base = node.key;
    }
    let absent = null;
    for (const [ index, name ] of names.entries()) {
      const field = schema.find(field => field.name === name);
      if (!field) {
        return { error: /^\d+$/.test(name) ? 'index' : 'unknown' };
      }
      value = value?.[name];
      base = base ? `${base}.${name}` : name;
      if (index === names.length - 1) {
        return {
          field,
          value,
          key: base,
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
      // An area the document holds is indexed; one it never stored isn't
      return (target.value?._id && content.ids.get(target.value._id)?.[0]) || {
        kind: 'area',
        key: target.key,
        value: target.value,
        field: target.field,
        widgets: [],
        within: getWithin(content, path)
      };
    }
    throw refuse([ {
      path,
      name: target.error || 'unknown'
    } ]);
  }

  // The widgets and items an area path is inside of, by its leading `@<id>`
  function getWithin(content, path) {
    if (!path.startsWith('@')) {
      return [];
    }
    const [ node ] = content.ids.get(path.split('.')[0].slice(1)) || [];
    return node ? [ ...node.within, node.value._id ] : [];
  }

  // The widget nodes of `ids`; a refusal naming every id that is no widget
  // AI sees in the document
  function findWidgets(content, ids) {
    const errors = [];
    const nodes = [];
    for (const _id of ids) {
      const found = content.ids.get(_id) || [];
      if ((found.length === 1) && (found[0].kind === 'widget')) {
        nodes.push(found[0]);
      } else {
        errors.push({
          path: `@${_id}`,
          name: (found.length > 1) ? 'ambiguous' : 'notfound'
        });
      }
    }
    if (errors.length) {
      throw refuse(errors);
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
  function getPlace(area, leaving, {
    position, before, after
  }) {
    const staying = area.widgets.filter(widget => !leaving.includes(widget._id));
    const neighbour = before ?? after;
    if (neighbour !== undefined) {
      if (!staying.some(widget => widget._id === neighbour)) {
        throw refuse([ {
          path: before ? 'before' : 'after',
          name: 'notfound'
        } ]);
      }
      return before ? { $before: before } : { $after: after };
    }
    const next = (position !== undefined) && staying[position];
    return next ? { $before: next._id } : {};
  }

  // A patch putting `widgets` into `area` at `where`: a `$push`, or the area
  // whole when the document never stored it, since there is nothing to push
  // into
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

  // `{ _id, type, index }` of each of `widgets` in the saved `doc`, `index`
  // counting the widgets AI sees in its area
  function locate(req, doc, widgets) {
    const content = indexContent(req, doc);
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
};
