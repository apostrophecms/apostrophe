var _ = require('@sailshq/lodash');

module.exports = function(self, options) {

  self.widgetManagers = {};

  // When a page is served to a logged-in user, make sure the session
  // contains a blessing for every join configured in schemas for widgets

  self.pageServe = function(req) {
    if ((!req) || (!req.res)) {
      throw new Error('pageServe did not receive req, which should never happen, since it is invoked by callAll with req. You should not call it directly.');
    }
    if (req.user) {
      var managers = self.widgetManagers;
      _.each(managers, function(manager, name) {
        var schema = manager.schema;
        if (schema) {
          self.apos.schemas.bless(req, schema);
        }
      });
    }
  };

  self.docBeforeUpdate = function(req, doc, options) {
    if (!(req && req.res)) {
      throw new Error(new Error('docBeforeUpdate did not receive req as the first argument. This method is called for you by callAll with (req, doc, options). In most cases there is no reason to call it directly.'));
    }
    if (!doc) {
      throw new Error(new Error('docBeforeUpdate did not receive a doc as its second argument. This method is called automatically for you with (req, doc, options). Possibly you tried to call docs.update or pieces.update with a null document, or you are invoking it directly with bad arguments. In most cases there is no reason to call it directly.'));
    }
    if (!(options && ((typeof options) === 'object'))) {
      throw new Error(new Error('The third argument to docBeforeUpdate must ben an options object. Normally this method is called for you on docs.update or pieces.update. In most cases there is no reason to call it directly.'));
    }
    // Must preserve existing values for any disallowed properties
    self.walk(doc, function(area, dotPath) {
      _.each(area.items || [], function(item, i) {
        if (doc._originalWidgets) {
          try {
            self.restoreDisallowedFields(req, item, doc._originalWidgets[item._id]);
          } catch (e) {
            self.apos.utils.error(e);
            self.apos.utils.error('May be bad widget data in doc ' + doc._id + ' with dotPath ' + dotPath + '.' + i + ', disregarding this widget');
          }
        }
      });
    });
  };

  // Restore the original values of any fields present in the
  // schema for a widget but disallowed for this particular editor
  // due to permissions.
  //
  // The original values are copied from `oldItem`. To save you
  // an "if" statement, if `oldItem` is null (commonplace if
  // the widget is new), nothing happens.
  //
  // If the field type has a `copy` method it is used.
  // Otherwise, custom logic handles `join` fields, and
  // the rest are copied by simple assignment to the
  // named field.

  self.restoreDisallowedFields = function(req, item, oldItem) {
    if (!(req && req.res)) {
      throw new Error(new Error('restoreDisallowedFields did not receive req as the first argument. This method is normally called for you by docBeforeUpdate. In most cases there is no reason to call it directly.'));
    }
    if (!(item && ((typeof item) === 'object'))) {
      throw new Error('The second argument to restoreDisallowedFields must be a widget object. This method is normally called for you by docBeforeUpdate. In most cases there is no reason to call it directly.');
    }
    var manager = self.getWidgetManager(item.type);
    if (!manager) {
      // Other code will handle complaining about the managerless, orphaned widgets
      return;
    }
    var originalSchema = manager.schema;
    var allowedSchema = manager.allowedSchema(req);
    var disallowed = _.filter(originalSchema, function(field) {
      return !_.find(allowedSchema, { name: field.name });
    });
    if (!disallowed.length) {
      return;
    }
    if (oldItem) {
      _.each(disallowed, function(field) {
        var fieldType = self.apos.schemas.fieldTypes[field.type];
        if (!fieldType) {
          throw new Error('Unknown schema field type');
        }
        if (fieldType.copy) {
          fieldType.copy(req, field, oldItem, item);
        } else if (field.name.match(/^_/)) {
          if (field.type.match(/^join/)) {
            if (field.type.match(/Reverse$/)) {
              return;
            }
            item[field.idField || field.idsField] = oldItem[field.idField || field.idsField];
            if (field.relationshipsField) {
              item[field.relationshipsField] = oldItem[field.relationshipsField];
            }
          }
        } else {
          item[field.name] = oldItem[field.name];
        }
      });
    }
  };

};
