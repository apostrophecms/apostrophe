// What keeps AI inside the schema: the AI-facing schema every rendering
// goes through, the ids the harness assigns, whole new content, and the
// values a tool definition lists so the model never guesses them.

module.exports = (self) => {
  return {
    // The schema AI reads and writes a document type or widget type through
    // (see `getAiSchema` of doc and widget types)
    getAiSchemaOf(req, manager) {
      return manager.getAiSchema(req);
    },

    /**
     * A new widget as AI authors it: every field it omits at its default
     * (`newInstance`, nested widgets and array items included), every id the
     * model sent replaced, so no `_id` can repeat one the document holds,
     * and every relationship given by ids in the locale of `req` (see
     * `newValue`).
     *
     * @param {object} req In the locale of the document written.
     * @param {object} widget The widget as the model sent it, with `type`.
     * @param {object} [options]
     * @param {string} [options._id] The widget's own `_id`, kept when it
     *   replaces a widget in place; a new one otherwise.
     * @returns {{ widget: object, ids: Array<{ _id: string, type: string }> }}
     *   `ids` are the widgets' new `_id`s, the outer one first, depth first.
     * @throws `invalid` for a type with no widget module.
     */
    newWidget(req, widget, { _id } = {}) {
      const content = newContent(self, req);
      return {
        widget: content.widget(widget, _id),
        ids: content.ids
      };
    },

    /**
     * A new array item or object from what AI wrote, its fields made as
     * `newWidget` makes a widget's.
     *
     * @param {object} req In the locale of the document written.
     * @param {object[]} schema The fields of the item or object.
     * @param {object} item
     * @param {object} [options]
     * @param {string} [options._id] Its own `_id`, kept when it replaces an
     *   item in place; a new one otherwise.
     * @returns {object}
     */
    newItem(req, schema, item, { _id } = {}) {
      return newContent(self, req).item(schema, item, _id);
    },

    /**
     * The value AI writes into `field`, as a new instance: an area's widgets
     * as `newWidget` makes them, array items and objects with new ids,
     * relationships as `{ _id }` entries in the locale of `req`, so an id
     * read in any locale or mode names the related document in the one
     * written. Any other value is returned as it is, for conversion to
     * check.
     *
     * @param {object} req In the locale of the document written.
     * @param {object} field A schema field.
     * @param {any} value
     * @returns {any}
     */
    newValue(req, field, value) {
      return newContent(self, req).value(field, value);
    },

    /**
     * A document as AI reads it: only the fields of its type's AI-facing
     * schema; in areas, only widgets of types the area allows that still
     * have a module, each with its own AI-facing schema's fields (shadow
     * fields included, such as rich text's `content`); arrays and objects
     * followed down; relationships as `{ _id, title }`.
     *
     * @param {object} req
     * @param {object} doc A document as `find` returns it.
     * @returns {object} `{ _id, type, ...fields }`.
     */
    projectDocument(req, doc) {
      const manager = self.apos.doc.getManager(doc.type);
      return {
        _id: doc._id,
        type: doc.type,
        ...self.projectFields(req, self.getAiSchemaOf(req, manager), doc)
      };
    },

    // A widget as AI reads it (see `projectDocument`), `null` for a type
    // without a module
    projectWidget(req, widget) {
      const manager = self.apos.area.getWidgetManager(widget?.type);
      return manager && {
        _id: widget._id,
        type: widget.type,
        ...self.projectFields(req, self.getAiSchemaOf(req, manager), widget)
      };
    },

    // The fields of `schema` in `value` as AI reads them (see
    // `projectDocument`)
    projectFields(req, schema, value) {
      const result = {};
      for (const field of schema) {
        if (!(field.name in value) && !(field.idsStorage in value)) {
          continue;
        }
        const given = value[field.name];
        if (field.type === 'area') {
          const allowed = Object.keys(self.apos.area.getWidgets(field.options || {}));
          result[field.name] = {
            _id: given?._id,
            items: (given?.items || [])
              .filter(widget => allowed.includes(widget?.type))
              .map(widget => self.projectWidget(req, widget))
              .filter(Boolean)
          };
        } else if (field.type === 'array') {
          result[field.name] = (Array.isArray(given) ? given : []).map(item => ({
            _id: item._id,
            ...self.projectFields(req, field.schema, item)
          }));
        } else if (field.type === 'object') {
          result[field.name] = given
            ? self.projectFields(req, field.schema, given)
            : null;
        } else if (field.type === 'relationship') {
          result[field.name] = Array.isArray(given)
            ? given.map(related => ({
              _id: related._id,
              title: related.title
            }))
            : (value[field.idsStorage] || []).map(_id => ({ _id }));
        } else if (field.type !== 'relationshipReverse') {
          result[field.name] = given;
        }
      }
      return result;
    },

    // The doc types AI may work with, for tool definitions: the content
    // types (see `apos.doc.getContentTypes`) without the denied ones
    getDocTypeNames() {
      const denied = self.apos.ai.getDeniedTypes();
      return self.apos.doc.getContentTypes()
        .map(manager => manager.name)
        .filter(name => !denied.includes(name))
        .sort();
    },

    // The widget types of the project, for tool definitions
    getWidgetTypeNames() {
      return Object.keys(self.apos.area.widgetManagers).sort();
    },

    // The locales of the project, for tool definitions
    getLocaleNames() {
      return Object.keys(self.apos.i18n.locales);
    }
  };
};

// Makes new content for the document `req` writes, collecting the `_id`s of
// the widgets it makes in `ids`, outer ones first
function newContent(self, req) {
  const ids = [];
  return {
    ids,
    widget,
    item,
    value
  };

  function widget(given, _id) {
    const manager = self.apos.area.getWidgetManager(given?.type);
    if (!manager) {
      throw self.apos.error('invalid', `"${given?.type}" is not a widget type`);
    }
    const own = _id || self.apos.util.generateId();
    ids.push({
      _id: own,
      type: given.type
    });
    return {
      ...item(self.getAiSchemaOf(req, manager), given, own),
      type: given.type,
      metaType: 'widget'
    };
  }

  // Every field it omits at its default, every field it holds made new
  function item(schema, given, _id) {
    const made = {
      ...self.apos.schema.newInstance(schema),
      ...given,
      _id: _id || self.apos.util.generateId()
    };
    for (const field of schema) {
      if (made[field.name] != null) {
        made[field.name] = value(field, made[field.name]);
      }
    }
    return made;
  }

  function value(field, given) {
    if (field.type === 'area') {
      // As reads show an area, or as a plain list of widgets
      const items = Array.isArray(given) ? given : given?.items;
      return {
        _id: self.apos.util.generateId(),
        metaType: 'area',
        items: Array.isArray(items) ? items.map(entry => widget(entry)) : []
      };
    }
    if ((field.type === 'array') && Array.isArray(given)) {
      return given.map(entry => ((entry && (typeof entry === 'object'))
        ? item(field.schema, entry)
        : entry));
    }
    if ((field.type === 'object') && given && (typeof given === 'object')) {
      return item(field.schema, given);
    }
    if ((field.type === 'relationship') && Array.isArray(given)) {
      return given.map(entry => related(field, entry));
    }
    return given;
  }

  // A related document by the `_id` the model sent, as a string or an
  // object, in the locale and mode written. Anything else is left for
  // conversion to refuse
  function related(field, entry) {
    const id = (typeof entry === 'string') ? entry : entry?._id;
    if (typeof id !== 'string') {
      return entry;
    }
    const [ aposDocId ] = id.split(':');
    const localized = self.apos.doc.getManager(field.withType)?.isLocalized();
    const fields = entry?._fields;
    return {
      _id: localized ? `${aposDocId}:${req.locale}:draft` : aposDocId,
      ...(fields && (typeof fields === 'object') && { _fields: fields })
    };
  }
}
