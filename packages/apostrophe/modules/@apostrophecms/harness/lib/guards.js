// What keeps AI inside the schema: the AI-facing schema every rendering
// goes through, the ids the harness assigns, whole new widgets, and the
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
     * model sent replaced, so no `_id` can repeat one the document holds.
     *
     * @param {object} req
     * @param {object} widget The widget as the model sent it, with `type`.
     * @param {object} [options]
     * @param {string} [options._id] The widget's own `_id`, kept when it
     *   replaces a widget in place; a new one otherwise.
     * @returns {{ widget: object, ids: Array<{ _id: string, type: string }> }}
     *   `ids` are the widgets' new `_id`s, the outer one first, depth first.
     * @throws `invalid` for a type with no widget module.
     */
    authorWidget(req, widget, { _id } = {}) {
      const ids = [];
      return {
        widget: author(widget, _id),
        ids
      };

      function author(widget, _id) {
        const manager = self.apos.area.getWidgetManager(widget?.type);
        if (!manager) {
          throw self.apos.error('invalid', `"${widget?.type}" is not a widget type`);
        }
        const schema = self.getAiSchemaOf(req, manager);
        const authored = {
          ...self.apos.schema.newInstance(schema),
          ...widget,
          _id: _id || self.apos.util.generateId(),
          type: widget.type,
          metaType: 'widget'
        };
        ids.push({
          _id: authored._id,
          type: authored.type
        });
        assignIds(schema, authored);
        return authored;
      }

      // Below a widget: widgets authored the same way, array items and
      // objects given new ids, relationships left as they are
      function assignIds(schema, value) {
        for (const field of schema) {
          const given = value[field.name];
          if (!given || (typeof given !== 'object')) {
            continue;
          }
          if (field.type === 'area') {
            value[field.name] = {
              ...given,
              _id: self.apos.util.generateId(),
              metaType: 'area',
              items: Array.isArray(given.items)
                ? given.items.map(item => author(item))
                : []
            };
          } else if ((field.type === 'array') && Array.isArray(given)) {
            value[field.name] = given.map(item => {
              const copy = {
                ...self.apos.schema.newInstance(field.schema),
                ...item,
                _id: self.apos.util.generateId()
              };
              assignIds(field.schema, copy);
              return copy;
            });
          } else if (field.type === 'object') {
            const copy = {
              ...self.apos.schema.newInstance(field.schema),
              ...given,
              _id: self.apos.util.generateId()
            };
            assignIds(field.schema, copy);
            value[field.name] = copy;
          }
        }
      }
    },

    /**
     * A document as AI reads it: only the fields of its type's AI-facing
     * schema; in areas, only widgets of types the area allows that still
     * have a module, each with its own schema's fields; arrays and objects
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
        ...project(self.getAiSchemaOf(req, manager), doc)
      };

      function project(schema, value) {
        const result = {};
        for (const field of schema) {
          if (!(field.name in value) && !(field.idsStorage in value)) {
            continue;
          }
          const given = value[field.name];
          if (field.type === 'area') {
            result[field.name] = projectArea(field, given);
          } else if (field.type === 'array') {
            result[field.name] = (Array.isArray(given) ? given : []).map(item => ({
              _id: item._id,
              ...project(field.schema, item)
            }));
          } else if (field.type === 'object') {
            result[field.name] = given ? project(field.schema, given) : null;
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
      }

      function projectArea(field, area) {
        const allowed = Object.keys(self.apos.area.getWidgets(field.options || {}));
        return {
          _id: area?._id,
          items: (area?.items || [])
            .filter(widget => allowed.includes(widget?.type))
            .map(widget => {
              const manager = self.apos.area.getWidgetManager(widget.type);
              return manager && {
                _id: widget._id,
                type: widget.type,
                ...project(self.getAiSchemaOf(req, manager), widget)
              };
            })
            .filter(Boolean)
        };
      }
    },

    // The doc types AI may work with, for tool definitions
    getDocTypeNames() {
      const denied = self.apos.ai.getDeniedTypes();
      return Object.keys(self.apos.doc.managers)
        .filter(name => !denied.includes(name))
        .filter(name => !name.startsWith('@apostrophecms/any-'))
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
